/**
 * Lambda function to process Garmin Activity data.
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
var AWS = require("aws-sdk");
var moment = require("moment");
const utils = require("/opt/utility/utils.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");

exports.lambdaHandler = async (event, context, callback) => {
  let body = lambdaGateway.inputGateway(event, context);
  // normalize keys
  let transformedData = [];
  for (let i = 0; i < body.data.length; i++) {
    transformedData[i] = utils.normalizeKeys(body.data[i]);
    transformedData[i] = utils.addNewField(transformedData[i], {
      calendar_date: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds,
        "X"
      ).format("YYYY-MM-DD"),
      start_time: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds,
        "X"
      ).format(),
      end_time: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds +
          transformedData[i].duration_in_seconds,
        "X"
      ).format(),
    });
    transformedData[i] = utils.removeField(transformedData[i], [
      "start_time_in_seconds",
      "start_time_offset_in_seconds",
      "duration_in_seconds",
    ]);
  }
  body.data = transformedData;
  lambdaGateway.outputGateway(JSON.stringify(body), callback);
};
