# frozen_string_literal: true
require 'json'
require 'aws-sdk-lambda'
require 'aws-sdk-s3'
require 'aws-xray-sdk/lambda'

require 'wheretz'
require "active_support/time"
require "active_support/time_with_zone"
require "active_support/values/time_zone"
require "active_support/core_ext/time/zones"
require "active_support/core_ext/object/blank"
require "active_support/core_ext/object/deep_dup"
require "active_support/core_ext/array/access"

Time.zone = 'Amsterdam'

module LambdaFunctions
  class FitCallbacks
    attr_reader :summary, :time_series, :accumulator, :laps

    # Ours to theirs
    SUMMARY_FIELDS_MAP = {
      title: :title,
      collection_type: :sport,
      collection_subtype: :sub_sport,
      duration: :total_timer_time,
      start_date: :start_time,
      end_date: :end_time,
      calories: :total_calories,
      elevation_gain: :total_ascent,
      elevation_loss: :total_descent,
      distance: :total_distance,
      avg_speed: :avg_speed,
      tz: 'tz'
    }.freeze

    # Ours to theirs
    STREAM_FIELDS_MAP = {
      hr: :heart_rate,
      speed: :speed,
      power: :power,
      elevation: :altitude,
      latlong: :latlong,
      distance: :distance,
      cadence: :cadence
    }.freeze

    # our_ts_key: { ours: :theirs }
    # missing entries in this map w.r.t lap specification are taken from the lap accumulator instead of the FIT lap record
    LAP_FIELDS_MAP = {
      hr: {
        max: :max_heart_rate,
        mean: :avg_heart_rate
      },
      speed: {
        max: :max_speed,
        mean: :avg_speed
      },
      power: {
        max: :max_power,
        mean: :avg_power
      },
      elevation: {},
      latlong: {},
      distance: {
        end: :lap_end_distance
      },
      cadence: {
        max: :max_cadence,
        mean: :avg_cadence
      }
    }.freeze

    def initialize(id,filename)
      @id = id
      @filename = filename
      @summary = {}
      @time_series = []
      @accumulator = {}
      @lap_accumulator = {}
      @laps = []
      @current_lap = {}
      @index = 0
    end

    # rubocop:disable Metrics/AbcSize
    # rubocop:disable Metrics/CyclomaticComplexity
    # rubocop:disable Metrics/PerceivedComplexity
    # rubocop:disable Metrics/MethodLength
    def on_record(msg)
      @last_timestamp ||= msg['timestamp']
      cp = { data_object_id: @id, offset: msg['timestamp'] - @last_timestamp }

      @current_lap[:start_index] ||= @index
      @current_lap[:end_index] = @index

      STREAM_FIELDS_MAP.each do |our_key, their_key|
        if our_key == :latlong
          our_value = latlong(msg)
          next if our_value.blank?

          @accumulator[our_key] ||= { start: our_value }
          @lap_accumulator[our_key] ||= { start: our_value }
        else
          computed = respond_to? our_key, true
          our_value = computed ? method(their_key).call(msg[their_key.to_s]) : msg[their_key.to_s]
          next if our_value.blank?

          @accumulator[our_key] ||= { start: our_value, min: our_value, max: our_value, mean: 0 }
          @lap_accumulator[our_key] ||= { start: our_value, min: our_value, max: our_value, mean: 0 }

          @accumulator[our_key][:mean] += our_value
          @accumulator[our_key][:min] = [@accumulator[our_key][:min], our_value].min
          @accumulator[our_key][:max] = [@accumulator[our_key][:max], our_value].max

          @lap_accumulator[our_key][:mean] += our_value
          @lap_accumulator[our_key][:min] = [@lap_accumulator[our_key][:min], our_value].min
          @lap_accumulator[our_key][:max] = [@lap_accumulator[our_key][:max], our_value].max
        end

        @accumulator[our_key][:end] = our_value
        @lap_accumulator[our_key][:end] = our_value

        cp[our_key] = our_value
      end

      @time_series << cp
      @index += 1
    end
    # rubocop:enable Metrics/PerceivedComplexity

    def print_msg(_msg); end

    def print_error_msg(msg)
      raise RuntimeError(msg)
    rescue StandardError => e
      Appsignal.set_error(e)
    end

    # Refer to Google Drive/FIT Documentation/profile.xls types page for a list of events. An example of an event is
    # 'workout', which represents the start/stop of a workout
    # The msg contains timestamp (seconds), data (depends on the event), event (workout, timer, battery...),
    # event_type (start,stop... depends on event) and event_group
    def on_event(_msg); end

    def on_device_info(_msg); end

    def on_user_profile(_msg); end

    def on_weight_scale_info(_msg); end

    def on_lap(msg)
      summaries = {}
      LAP_FIELDS_MAP.each do |ts_key, fields_map|
        ts = @lap_accumulator[ts_key]
        next if ts.nil?

        # Initialize the summary with our computed values
        summaries[ts_key] = ts
        summaries[ts_key][:mean] /= @current_lap[:end_index] - @current_lap[:start_index] + 1 if ts[:mean].present?
        # Override our computed values with theirs only if they exist
        fields_map.each do |ours, theirs|
          computed = respond_to? theirs, true
          their_value = computed ? method(theirs).call(msg) : msg[theirs.to_s]
          summaries[ts_key][ours] = their_value if their_value.present?
        end
      end

      @current_lap[:summaries] = summaries if summaries.present?

      @laps << @current_lap.deep_dup
      @current_lap = {}
      @lap_accumulator = {}
    end

    # Session messages define the type of activity that is recorded (sport, sport subtype) and some summary information
    # A file may contain more than one session (see Google Drive/FIT Documentation/FIT Filetypes Description Rev 2.2.pdf
    # page 51), which may or may not be of the same sport type. We need to think on how to
    # deal with this (ideally we would create a different versioned_data_object for each session). For now we keep the
    # last session that was recorded
    def on_session(msg)
      @theirs = msg
      SUMMARY_FIELDS_MAP.each do |our_key, their_key|
        computed = respond_to? our_key, true
        @summary[our_key] = computed ? method(our_key).call(@theirs[their_key.to_s]) : @theirs[their_key.to_s]
      end
    end

    def on_activity(_msg); end

    private

    # Maps FIT sport values to our collection types.
    # @param sport [Integer] the sport to find in the enum.
    # @return [String] one of the {#Roaster::COLLECTION_TYPES} constants.
    def collection_type(sport)
      case sport
      when 1
        'RUNNING'
      when 2
        'RIDING'
      when 5
        'SWIMMING'
      when 7
        'SOCCER'
      when 11
        'STEPS'
      when 17
        'HIKING'
      when 33
        'ICE_SKATING'
      when 30
        'INLINE_SKATING'
      else
        'FIT'
      end
    end

    def title(_)
      @filename
    end

    def start_date(start_time = nil)
      @start_date = Time.zone.at(start_time) if start_time

      @start_date ||= Time.zone.now
    end

    def end_date(end_time = nil)
      if end_time
        Time.zone.at(end_time)
      else
        duration = (@theirs['total_elapsed_time'] || 1).seconds
        start_date + duration
      end
    end

    # Computes the distance-end value of a lap such that the lap distance (end - start) matches the FIT lap distance value
    # @return [Float] the end distance of the lap
    def lap_end_distance(msg)
      theirs = msg['total_distance']
      return @lap_accumulator[:distance][:end] if theirs.blank?

      @lap_accumulator[:distance][:start] + theirs.to_f
    end

    def collection_subtype(sub_sport)
      case sub_sport
      when 6
        'INDOOR_CYCLING'
      when 1
        'INDOOR_RUNNING'
      else
        'GENERIC_SUBTYPE'
      end
    end

    def latlong(msg)
      return nil unless msg['position_lat'] && msg['position_long']

      [
        format('%<position_lat>0.6f', position_lat: msg['position_lat']).to_f,
        format('%<position_long>0.6f', position_long: msg['position_long']).to_f
      ]
    end

    def duration(total)
      return total if total.present?

      @theirs['total_elapsed_time']
    end

    def tz(_msg)
      start_pos = start_position(@theirs)
      # Nothing to do unless both lat and long are available
      return nil if start_pos.blank? || start_pos.any?(&:blank?)

      WhereTZ.lookup start_pos.first, start_pos.second
    rescue ArgumentError
      # An ArgumentError is raised if the start point of the polyline is not in a valid time zone (e.g. in the middle of
      # the ocean)
      nil
    end

    def start_position(msg)
      return [] if msg.blank?

      [msg['start_position_lat'], msg['start_position_long']]
    end
  end

  class SDVFitRoaster
    require 'fast_polylines'
    require 'rubyfit'
    def perform_roast file_content
      callbacks = FitCallbacks.new(1,"Test")
      parser = RubyFit::FitParser.new(callbacks)
      parser.parse(file_content)
      @summary = summarize_time_series(callbacks)

      @summary[:laps] = callbacks.laps if callbacks.laps.count.positive?

      sdv_object ||= {}
      sdv_object[:summary] = @summary
      sdv_object[:time_series] = callbacks.time_series
    end

    def summarize_time_series(callbacks)
      # Nothing to do if there are no time series entries
      return {} if  (callbacks.accumulator.empty?  || callbacks.accumulator.nil?)

      summary = callbacks.summary
      summary[:time_series_summaries] = callbacks.accumulator

      summary[:time_series_summaries].each do |key, value|
        next if value[:mean].blank?

        summary[:time_series_summaries][key][:mean] = value[:mean].to_f / callbacks.time_series.count
      end

      time_series = callbacks.time_series

      if time_series.find { |sample| sample.key?(:latlong) }.present?
        latlong = callbacks.time_series.map { |ts| ts[:latlong] }.filter(&:present?)
        summary[:polyline] = FastPolylines.encode(latlong)
      end

      summary
    end
  end

  def LambdaFunctions.object_downloaded(s3_client, bucket_name, object_key)
    s3_client.get_object(
      bucket: bucket_name,
      key: object_key
    )
  rescue StandardError => e
    puts "Error getting object: #{e.message}"
  end

  def LambdaFunctions.upload_file(s3_client, key, bucket_name, body, tag = '')
    object = s3_client.put_object(
      bucket: bucket_name,
      key: key,
      body: body,
      tagging: tag,
      content_type: 'text/json')
  rescue StandardError => e
    puts "Error getting object: #{e.message}"
  end

  class Handler
    def self.process(event:,context:)
      body = event['result']
      bucket_name = ENV['BUCKET_NAME']
      object_key = body['data']['fitDataKey']
      region = ENV['AWS_REGION']
      s3_params = ENV['Test'] == 'true' ? { region: region, endpoint: ENV['endpoint'], force_path_style: true } : { region: region, force_path_style: true }

      s3_client = Aws::S3::Client.new(s3_params)
      fitFile = LambdaFunctions.object_downloaded(s3_client, bucket_name, object_key)

      fitFileDecoded = Base64.strict_decode64(JSON.parse((fitFile.body).string)['base64']).force_encoding('UTF-8')
      my_obj = SDVFitRoaster.new

      body['data']['sdv_object'] = my_obj.perform_roast fitFileDecoded
      key = body['data']['userId'] + '-' + body['data']['summaryId']
      path = body['type'] + "/processed/"
      LambdaFunctions.upload_file(s3_client, path + key, bucket_name, JSON.generate(body),  `Status='Processed'`)
      body['data']['status'] = "Processed"
      puts body['data']['sdv_object']
      body['data'].delete('sdv_object')
      response = {
        isBase64Encoded: false,
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.generate(body),
      }
    end
  end
end
# rubocop:enable Metrics/AbcSize
# rubocop:enable Metrics/CyclomaticComplexity
# rubocop:enable Metrics/MethodLength
