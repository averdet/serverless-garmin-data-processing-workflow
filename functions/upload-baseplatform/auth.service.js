var jwt = require("jsonwebtoken");

class AuthService {
  constructor() {}

  async validate(userData) {
    if (userData === undefined || userData.uuid === undefined) {
      return undefined;
    }

    try {
      //   return await this.userService.findByUuid(userData.uuid);
    } catch (error) {
      console.error(
        "User with UUID %s not found. %s",
        userData.uuid,
        error
      );
    }
  }

  async login(user) {
    const expiresIn = 3600;
    // const userData = await this.validate(user);
    // if (!userData) {
    //   return {
    //     expires_in: 0,
    //     access_token: null,
    //     user_id: null,
    //     status: 404,
    //   };
    // }
    const payload = this.createPayload(
      //   userData.uuid,
      user,
      expiresIn,
      process.env.JWT_JTI
    );
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET_KEY);

    return {
      expires_in: expiresIn,
      access_token: accessToken,
      user_id: payload,
      status: 200,
    };
  }

  createPayload(uuid, expiresIn, jti) {
    const date = new Date();
    return JSON.stringify({
      sub: uuid,
      scp: "user",
      aud: null,
      iat: date.valueOf(),
      exp: date.valueOf() + expiresIn,
      jti: jti,
    });
  }
}

module.exports = AuthService;
