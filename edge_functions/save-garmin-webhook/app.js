/**
 * Lambda Function that performs saving of data into DynamoDB.
 * This Function performs batch write
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
let _ = require("lodash");
const AWS = require("aws-sdk");
const lambdaGateway = require("./utility/lambda_gateway.js");

const ggSdk = require('aws-greengrass-core-sdk');

const iotClient = new ggSdk.IotData();

const config = {
  region: 'us-east-2',
  endpoint: 'dynamodb.us-east-2.amazonaws.com',
};
const tableName = 'HealthIntegrationProcessed';
const docClient = new AWS.DynamoDB.DocumentClient(config);
const integration = 'garmin';

exports.lambdaHandler = async (event, context, callback) => {
  //let body = lambdaGateway.inputGateway(event, context);
  let body = event.result;

  var splitRecordsBy25 = _.chunk(body.data, 25);
  for (let i = 0; i < splitRecordsBy25.length; i++) {
    var putItems = [];
    putItems = wrapRecord(body.type, splitRecordsBy25[i]);
    var tableItems = {};
    tableItems[tableName] = putItems;
    await writeItems(tableItems, 0, context, i);
  }

  const pubOpt = {
          topic: 'research/output/f6',
          payload: JSON.stringify({"result": {'Status': 'Processed'}}),
          queueFullPolicy: 'AllOrError',
    };
    iotClient.publish(pubOpt, publishCallback);

  //lambdaGateway.outputGateway(JSON.stringify({'Status': 'Processed'}), callback);
};

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