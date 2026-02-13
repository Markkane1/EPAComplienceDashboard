import fs from "fs";
import path from "path";
import { AuthError } from "../../../domain/errors/AuthErrors.js";
import { config } from "../../../infrastructure/config/config.js";

const getUserId = (req) => req.user?._id?.toString();

export const createAuthController = ({
  applicantLoginUseCase,
  loginUseCase,
  magicLoginUseCase,
  magicLoginRequestUseCase,
  signupBlockedUseCase,
  signupUseCase,
  verifyEmailUseCase,
  getMeUseCase,
  updateProfileUseCase,
  updateProfileImageUseCase,
  removeProfileImageUseCase,
  changePasswordUseCase,
}) => {
  const handle = (fn) => async (req, res, next) => {
    try {
      const result = await fn(req, res);
      if (result) {
        res.status(result.status ?? 200).json(result.body);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ message: error.message });
      }
      return next(error);
    }
  };

  return {
    applicantLogin: handle(async (req) => {
      return applicantLoginUseCase.execute({
        cnic: req.body?.cnic,
        email: req.body?.email,
        request: req,
      });
    }),
    login: handle(async (req) => {
      return loginUseCase.execute({
        email: req.body?.email,
        password: req.body?.password,
        request: req,
      });
    }),
    magicLogin: handle(async (req) => {
      return magicLoginUseCase.execute({
        token: req.query?.token,
        request: req,
      });
    }),
    magicRequest: handle(async (req) => {
      return magicLoginRequestUseCase.execute({
        email: req.body?.email,
        request: req,
      });
    }),
    signup: handle(async (req) => {
      return signupBlockedUseCase.execute({
        email: req.body?.email,
        request: req,
      });
    }),
    signupLegacy: handle(async (req) => {
      return signupUseCase.execute({
        email: req.body?.email,
        password: req.body?.password,
        full_name: req.body?.full_name,
        cnic: req.body?.cnic,
        request: req,
      });
    }),
    verifyEmail: handle(async (req) => {
      return verifyEmailUseCase.execute({
        token: req.query?.token,
        request: req,
      });
    }),
    me: handle(async (req) => {
      return getMeUseCase.execute({ userId: getUserId(req) });
    }),
    updateProfile: handle(async (req) => {
      return updateProfileUseCase.execute({
        userId: getUserId(req),
        first_name: req.body?.first_name,
        last_name: req.body?.last_name,
        designation: req.body?.designation,
        contact_number: req.body?.contact_number,
        email: req.body?.email,
        cnic: req.body?.cnic,
        request: req,
      });
    }),
    updateProfileImage: handle(async (req, res) => {
      if (!req.file) {
        res.status(400).json({ message: "Profile image is required." });
        return null;
      }

      if (req.user?.profile_image_path) {
        const existingPath = path.join(process.cwd(), req.user.profile_image_path);
        if (fs.existsSync(existingPath)) {
          fs.unlinkSync(existingPath);
        }
      }

      const relativePath = path.relative(config.uploadDir, req.file.path).replace(/\\\\/g, "/");
      const profileImagePath = `uploads/${relativePath}`;
      return updateProfileImageUseCase.execute({
        userId: getUserId(req),
        profileImagePath,
        request: req,
      });
    }),
    removeProfileImage: handle(async (req) => {
      if (req.user?.profile_image_path) {
        const existingPath = path.join(process.cwd(), req.user.profile_image_path);
        if (fs.existsSync(existingPath)) {
          fs.unlinkSync(existingPath);
        }
      }
      return removeProfileImageUseCase.execute({
        userId: getUserId(req),
        request: req,
      });
    }),
    changePassword: handle(async (req) => {
      return changePasswordUseCase.execute({
        userId: getUserId(req),
        current_password: req.body?.current_password,
        new_password: req.body?.new_password,
        request: req,
      });
    }),
  };
};
