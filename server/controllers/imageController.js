import axios from "axios";
import userModel from '../models/userModel.js';
import FormData from "form-data";
import dotenv from "dotenv";
dotenv.config(); // ✅ Load environment variables

export const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.userId; // ✅ from middleware

    if (!userId || !prompt) {
      return res.json({ success: false, message: 'Missing Details' });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    if (user.creditBalance <= 0) {
      return res.json({
        success: false,
        message: 'No Credit Balance',
        creditBalance: user.creditBalance,
      });
    }

    const clipdropApiKey = process.env.CLIPDROP_API?.trim();
    if (!clipdropApiKey) {
      return res.json({ success: false, message: 'ClipDrop API key is missing or empty.' });
    }

    const formData = new FormData();
    formData.append('prompt', prompt);

    const { data } = await axios.post(
      'https://clipdrop-api.co/text-to-image/v1',
      formData,
      {
        headers: {
          ...formData.getHeaders(), // ✅ Required for multipart form
          'x-api-key': clipdropApiKey,
        },
        responseType: 'arraybuffer',
      }
    );

    const base64Image = Buffer.from(data, 'binary').toString('base64');
    const resultImage = `data:image/png;base64, ${base64Image}`;

    await userModel.findByIdAndUpdate(userId, {
      creditBalance: user.creditBalance - 1,
    });

    res.json({
      success: true,
      message: 'Image Generated',
      creditBalance: user.creditBalance - 1,
      resultImage,
    });
  } catch (error) {
    console.error("Error in generateImage:", error.message);
    res.json({ success: false, message: error.message });
  }
};
