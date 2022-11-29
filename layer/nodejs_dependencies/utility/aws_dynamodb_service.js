const AWSDynamo = require("aws-sdk");
var AWSXRay = require("aws-xray-sdk-core");
// Configure the context missing strategy to do nothing
AWSXRay.setContextMissingStrategy(() => {});
const paramsDynamo =
  process.env.Test === "true"
    ? {
        apiVersion: "2012-08-10",
        region: process.env.AWS_REGION,
        endpoint: process.env.endpoint,
      }
    : {
        apiVersion: "2012-08-10",
        region: process.env.AWS_REGION,
      };
var dynamodb = AWSXRay.captureAWSClient(new AWSDynamo.DynamoDB(paramsDynamo));

exports.getPayload = function (key, tableName) {
  var params = {
    Key: key,
    TableName: tableName,
  };
  // return dynamodb
  //   .getItem(params, function (err, data) {
  //     if (err) console.log(err, err.stack);
  //     // an error occurred
  //     else console.log(data);
  //     return data; // successful response
  //   })
  //   .promise();
  return dynamodb.getItem(params).promise();
};

exports.setPayload = async function (key, bucketName, body, tag = "") {};
