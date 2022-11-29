const crypto = require("crypto");
const uuid = require('lambda-uuid');
const axios = require("axios");
const Methods = {
  POST: "POST",
  GET: "GET",
  DELETE: "DELETE",
};

function sign_url(
  method,
  base_url,
  consumer_key,
  consumer_secret,
  oauth_token,
  oauth_token_secret,
  data = {}
) {
  const oauth_timestamp = Math.floor(Date.now() / 1000);
  const oauth_nonce = uuid();
  const oauthSignatureMethod = "HMAC-SHA1";
  const oauthVersion = "1.0";

  const oauthParams = {
    method: method,
    url: base_url,
    oauthNonce: oauth_nonce,
    oauthTimestamp: oauth_timestamp,
    oauthSignatureMethod: oauthSignatureMethod,
    oauthVersion: oauthVersion,
    oauthToken: oauth_token,
    data: data,
  };

  const signature = generateSignature(
    oauthParams,
    oauth_token_secret,
    consumer_key,
    consumer_secret
  );
  return getAuthorizationHeader(oauthParams, signature, consumer_key);
}

function getBaseString(
  {
    method,
    url,
    oauthNonce,
    oauthSignatureMethod,
    oauthTimestamp,
    oauthVersion,
    oauthToken,
    oauthVerifier,
    data,
  },
  clientId = ""
) {
  // Sort parameters before performing base url signing. Parameters that share the same key name needs to be sorted by value(Pending) https://oauth.net/core/1.0a/#encoding_parameters
  const parameters = {
    ...data,
    oauth_consumer_key: clientId,
    oauth_signature_method: oauthSignatureMethod,
    oauth_timestamp: oauthTimestamp,
    oauth_nonce: oauthNonce,
    ...(oauthToken && { oauth_token: oauthToken }),
    ...(oauthVerifier && { oauth_verifier: oauthVerifier }),
    oauth_version: oauthVersion,
  };
  const ordered = {};
  Object.keys(parameters)
    .sort()
    .forEach(function (key) {
      ordered[key] = parameters[key];
    });

  let encodedParameters = "";

  for (const k in ordered) {
    const encodedValue = escape(ordered[k]);
    const encodedKey = encodeURIComponent(k);
    if (encodedParameters !== "") {
      encodedParameters += encodeURIComponent("&");
    }
    encodedParameters += encodeURIComponent(`${encodedKey}=${encodedValue}`);
  }
  // Note that we do not want to uri encode the & in between
  const base = `${method}&${encodeURIComponent(url)}&${encodedParameters}`;
  return base;
}

function generateSignature(
  oauthSignatureParameters,
  requestTokenSecret = "",
  consumer_key = "",
  clientSecret = ""
) {
  const text = getBaseString(oauthSignatureParameters, consumer_key);
  // Note that the request token secret can be '' by design
  const key = `${clientSecret}&${requestTokenSecret}`;

  const base64signature = crypto
    .createHmac("sha1", key)
    .update(text)
    .digest("base64");
  return encodeURIComponent(base64signature);
}

function getAuthorizationHeader(
  {
    oauthNonce,
    oauthSignatureMethod,
    oauthTimestamp,
    oauthVersion,
    oauthToken,
    oauthVerifier,
  },
  oauthSignature,
  clientId
) {
  let header = "OAuth ";
  header += oauthVerifier ? `oauth_verifier="${oauthVerifier}",` : "";
  header += `oauth_version="${oauthVersion}",`;
  header += `oauth_consumer_key="${clientId}",`;
  header += oauthToken ? `oauth_token="${oauthToken}",` : "";
  header += `oauth_timestamp="${oauthTimestamp}",`;
  header += `oauth_nonce="${oauthNonce}",`;
  header += `oauth_signature_method="${oauthSignatureMethod}",`;
  header += `oauth_signature="${oauthSignature}"`;
  return header;
}

async function handleGet(url, authHeader, data = {}, options = {}) {
  const urlObj = new URL(url);
  Object.keys(data).forEach((k) => {
    urlObj.searchParams.set(k, data[k]);
  });

  return axios.get(urlObj.toString(), {
    headers: { Authorization: authHeader },
    ...options,
  });
}

module.exports = { sign_url, Methods, handleGet };
