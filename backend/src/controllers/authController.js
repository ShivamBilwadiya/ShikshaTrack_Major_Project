import * as authService from '../services/authService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'Email and password are required.', 400);
    }

    const result = await authService.loginUser(email, password);
    return sendSuccess(res, 'Login successful.', result);
  } catch (err) {
    return sendError(res, err.message, 401);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUserProfile(req.user.id);
    return sendSuccess(res, 'User profile fetched successfully.', user);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  // Stateless JWT logout (client deletes token)
  return sendSuccess(res, 'Logged out successfully.');
};

