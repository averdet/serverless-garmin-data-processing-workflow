/**
 * Lambda Function that performs saving of data into Landing Zone.
 * This Function performs batch write
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
let _ = require("lodash");
const AWS = require("aws-sdk");
var moment = require("moment");
const s3Operation = require("/opt/utility/aws_s3_service.js");
const utils = require("/opt/utility/utils.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");

const config = {
  region: process.env.AWS_REGION,
  endpoint: process.env.endpoint,
};
const tableName = process.env.tableName;
const docClient = new AWS.DynamoDB.DocumentClient(config);
const integration = process.env.integration;

exports.lambdaHandler = async (event, context, callback) => {
  const body = lambdaGateway.inputGateway(event, context);
  const year = moment().format("YYYY");
  const month = moment().format("MM");
  const day = moment().format("DD");
  const prefix = "/" + body.type + "/" + year + "/" + month + "/" + day;
  const s3Promises = [];
  for (let i = 0; i < body.data.length; i++) {
    const key = body.data[i].userId + "_" + body.data[i].summaryId;
    metadata = createMetadata(
      body.type,
      body.data[i],
      moment().format("YYYY-MM-DD")
    );
    s3Promises.push(
      s3Operation.setPayload(
        key,
        process.env.BUCKET_NAME + prefix,
        JSON.stringify(body.data[i]),
        metadata
      )
    );
  }
  await Promise.all(s3Promises).then((pathValueLocation) => {
    pathValueLocation.forEach((value, index) => {
      body.data[index].landingZonePath = value;
    });
  });
    
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

  var splitRecordsBy25 = _.chunk(body.data, 25);
  for (let i = 0; i < splitRecordsBy25.length; i++) {
    var putItems = [];
    putItems = wrapRecord(body.type, splitRecordsBy25[i]);
    var tableItems = {};
    tableItems[tableName] = putItems;
    await writeItems(tableItems, 0, context, i);
  }

  lambdaGateway.outputGateway(JSON.stringify({'Status': 'Processed'}), callback);
};

function createMetadata(type, body, date) {
  return `Integration=${integration}&Type=${type}&Date=${date}&User=${body.userId}&Status=Unprocessed`;
}

function wrapRecord(type, body) {
  var items = [];
  body.forEach(function (record) {
    items.push({
      PutRequest: {
        Item: {
          Id: integration + record.summary_id,
          Type: type,
          UserId: record.user_id,
          Timestamp: Date.now(),
          Record: record,
        },
      },
    });
  });
  return items;
}

async function writeItems(items, retries, context, index) {
  try {
    console.log("Processing Batch ", index + 1);
    const response = await docClient
      .batchWrite({ RequestItems: items })
      .promise();

    if (Object.keys(response.UnprocessedItems).length) {
      console.log("Unprocessed items remain, retrying.");
      var delay = Math.min(
        Math.pow(2, retries) * 100,
        context.getRemainingTimeInMillis() - 200
      );
      setTimeout(function () {
        writeItems(response.UnprocessedItems, retries + 1);
      }, delay);
    } else {
      console.log("Processed Batch ", index + 1);
    }
  } catch (error) {
    console.log("DDB call failed: " + error, error.stack);
    return context.fail(error);
  }
}

