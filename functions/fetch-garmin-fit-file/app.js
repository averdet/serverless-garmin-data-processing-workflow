/**
 * Lambda function to Fetch Garmin Fit File and save it to AWS S3
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
// var AWS = require("aws-sdk");
const oauth_v1_handler = require("/opt/utility/oauth_v1_service.js");
const s3Operation = require("/opt/utility/aws_s3_service.js");
const secretManagerClient = require("/opt/utility/aws_secret_manager_service.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");
const utils = require("/opt/utility/utils.js");
// const fitFileService = require("fit_file_service");

const consumer_key = process.env.GARMIN_CONSUMER_KEY;
const consumer_secret = process.env.GARMIN_CONSUMER_SECRET;

exports.lambdaHandler = async (event, context, callback) => {
  const body = lambdaGateway.inputGateway(event, context);
  consolidatedFitData = [];

  secretName = body.data[0].userAccessToken;
  const tempSecret = await secretManagerClient.retrieveSecret(secretName);
  const secret = JSON.parse(tempSecret.SecretString);

  for (i = 0; i < body.data.length; i++) {
    const callBackURL = body.data[i].callbackURL;
    const activityFileUrl = new URL(callBackURL);
    const data = { id: activityFileUrl.searchParams.get("id") };

    const header = oauth_v1_handler.sign_url(
      oauth_v1_handler.Methods.GET,
      activityFileUrl.href.split("?")[0],
      consumer_key,
      consumer_secret,
      secret.oauth_token,
      secret.oauth_token_secret,
      data
    );
    const fitFile = await oauth_v1_handler.handleGet(
      activityFileUrl.href.split("?")[0],
      header,
      data,
      { responseType: "arraybuffer" }
    );
    let fitFileLocation = "";

    // const fitFileData = fitFileService.parseFitFile(fitFile.data)

    const key = body.data[i].userAccessToken + "_" + body.data[i].summaryId;
    fitFileLocation = await s3Operation.setPayload(
      key,
      process.env.BUCKET_NAME,
      JSON.stringify(utils.wrapBase64Data(fitFile.data, body.data[i].summaryId))
    );

    consolidatedFitData.push({
      ...body.data[i],
      fitDataKey: key,
      fitDataLocation: fitFileLocation,
    });
  }
  responseBody = {
    type: body.type,
    isBinary: body.isBinary,
    sendDataToBackend: body.sendDataToBackend,
    applyMapState: body.applyMapState,
    data: consolidatedFitData,
  };

  lambdaGateway.outputGateway(JSON.stringify(responseBody), callback);
};
