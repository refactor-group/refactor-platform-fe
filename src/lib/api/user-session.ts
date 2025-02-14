// Interacts with the user_session_controller endpoints
import { siteConfig } from "@/site.config";
import {
  defaultUserSession,
  isUserSession,
  parseUserSession,
  UserSession,
} from "@/types/user-session";
import { AxiosError, AxiosResponse } from "axios";

export const loginUser = async (
  email: string,
  password: string
): Promise<UserSession> => {
  const axios = require("axios");

  console.log("email: ", email);
  console.log("password: ", password.replace(/./g, "*"));

  var userSession: UserSession = defaultUserSession();
  var err: string = "";

  const data = await axios
    .post(
      `${siteConfig.env.backendServiceURL}/login`,
      {
        email: email,
        password: password,
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        setTimeout: 5000, // 5 seconds before timing out trying to log in with the backend
      }
    )
    .then(function (response: AxiosResponse) {
      // handle success
      const userSessionData = response.data.data;
      if (isUserSession(userSessionData)) {
        userSession = parseUserSession(userSessionData);
      } else {
        // Even if the log in is successful, if we don't have user data that we can
        // deserialize successfully, then downstream operations will see the default
        // userSessionData in state and we will experience subtle Bugs. We should consider
        // how best we want to handle this. Ex. clear auth cookie?
        console.debug("userSessionData: ", userSessionData)
        throw { message: 'Login Failed to Produce valid User Session Data' }
      }
    })
    .catch(function (error: AxiosError) {
      // handle error
      console.error(error.response?.status);
      if (error.response?.status == 401) {
        err = "Login failed: unauthorized";
      } else {
        err = `Login failed: ${error.message}`;
      }
    });

  if (err) {
    console.error(err);
    throw err;
  }

  return userSession;
};

export const logoutUser = async (): Promise<string> => {
  const axios = require("axios");

  const data = await axios
    .get(`${siteConfig.env.backendServiceURL}/logout`, {
      withCredentials: true,
      setTimeout: 5000, // 5 seconds before timing out trying to log in with the backend
    })
    .then(function (response: AxiosResponse) {
      // handle success
      console.debug(response);
    })
    .catch(function (error: AxiosError) {
      // handle error
      const err = `Logout failed: ${error.message}`;
      console.error(err);
      return err;
    });

  return "";
};
