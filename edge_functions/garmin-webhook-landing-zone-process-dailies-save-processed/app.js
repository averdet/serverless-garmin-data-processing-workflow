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
const s3Operation = require("./utility/aws_s3_service.js");
const lambdaGateway = require("./utility/lambda_gateway.js");
const utils = require("./utility/utils.js");

const integration = 'garmin';

const ggSdk = require('aws-greengrass-core-sdk');

const iotClient = new ggSdk.IotData();

const config = {
  region: 'us-east-2',
  endpoint: 'dynamodb.us-east-2.amazonaws.com',
};
const tableName = 'HealthIntegrationProcessed';
const docClient = new AWS.DynamoDB.DocumentClient(config);

exports.lambdaHandler = async (event, context, callback) => {
  //const body = lambdaGateway.inputGateway(event, context);
  const body = event.result;
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
        'health-integration-garmin' + prefix,
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
    transformedData[i] = utils.keepField(
      transformedData[i],
      utils.garminHeaderParams + utils.garminDailiesAllowedParams
    );
  }
  body.data = transformedData

  var splitRecordsBy25 = _.chunk(body.data, 25);
  for (let i = 0; i < splitRecordsBy25.length; i++) {
    var putItems = [];
    putItems = wrapRecord(body.type, splitRecordsBy25[i]);
    var tableItems = {};
    tableItems[tableName] = putItems;
    await writeItems(tableItems, 0, context, i);
  }

  const pubOpt = {
          topic: 'research/output/f3f4f6',
          payload: JSON.stringify({"result": {'Status': 'Processed'}}),
          queueFullPolicy: 'AllOrError',
    };
    iotClient.publish(pubOpt, publishCallback);

  //lambdaGateway.outputGateway(JSON.stringify(body), callback);
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

function publishCallback(err, data) {
    console.log(err);
    console.log(data);
}