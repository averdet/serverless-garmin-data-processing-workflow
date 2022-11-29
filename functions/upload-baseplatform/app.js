/**
 * Lambda function to upload record to baseplatform.
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
var AWS = require("aws-sdk");
const utils = require("/opt/utility/utils.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");
const s3Operation = require("/opt/utility/aws_s3_service.js");
const BackendService = require("./backend.service");
const AuthService = require("./auth.service");
const dynamoDBService = require("/opt/utility/aws_dynamodb_service.js");

exports.lambdaHandler = async (event, context, callback) => {
  let body = lambdaGateway.inputGateway(event, context);
  let backend_service = new BackendService();
  let auth_service = new AuthService();
  let key;
  if (body.isBinary) {
    key = {
      UserId: {
        S: Array.isArray(body.data) ? body.data[0].userId : body.data.userId,
      },
    };
  } else {
    key = {
      UserId: {
        S: Array.isArray(body.data) ? body.data[0].user_id : body.data.user_id,
      },
    };
  }
  const user = await dynamoDBService.getPayload(key, process.env.User_Table);
  let token = await auth_service.login(
    parseInt(Object.values(user.Item.uuid)[0])
  );
  let consolidatedData = [];
  if (body.isBinary) {
    if (Array.isArray(body.data)) {
      for (i = 0; i < body.data.length; i++) {
        let tempData = await s3Operation.getPayload(
          body.data[i].fitDataKey,
          process.env.BUCKET_NAME
        );
        consolidatedData.push(JSON.parse(tempData));
      }
    } else {
      let tempData = await s3Operation.getPayload(
        body.data.fitDataKey,
        process.env.BUCKET_NAME
      );
      consolidatedData.push(JSON.parse(tempData));
    }
  } else {
    Array.isArray(body.data) ? consolidatedData.push(...body.data) : consolidatedData.push(body.data);
  }
  wrappedData = utils.wrapDataToSendBaseplatform(
    process.env.integration,
    consolidatedData,
    body.isBinary
  );
  await backend_service.sendData(wrappedData, token.access_token);
  body.status = "Record Sent to Base Platform";
  lambdaGateway.outputGateway(JSON.stringify(body), callback);
};
