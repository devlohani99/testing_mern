const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PinataSDK = require('@pinata/sdk'); // Import the SDK
require('dotenv').config();
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;
const fs = require('fs');

// Initialize Pinata SDK with JWT
const pinata = new PinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Image Schema and Model
const ImageSchema = new mongoose.Schema({
  ipfsHash: String,
});
const Image = mongoose.model('Image', ImageSchema);

// Multer Configuration (temporary storage for uploaded files)
const upload = multer({ dest: 'uploads/' });

// Upload Route
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', file); // Debug log

    // Upload to Pinata
    try {
      const readableStreamForFile = fs.createReadStream(file.path);
      const options = {
        pinataMetadata: {
          name: file.originalname
        }
      };
      const uploadResult = await pinata.pinFileToIPFS(readableStreamForFile, options);
      console.log('Pinata upload result:', uploadResult); // Debug log
      const ipfsHash = uploadResult.IpfsHash;

      // Save the hash to MongoDB
      await Image.create({ ipfsHash });

      // Clean up the temporary file
      fs.unlinkSync(file.path);

      res.json({ message: 'Image uploaded successfully', ipfsHash });
    } catch (pinataError) {
      console.error('Pinata specific error:', pinataError);
      res.status(500).json({ error: 'Failed to upload to Pinata', details: pinataError.message });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});