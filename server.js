const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();

const twilio = require('twilio');
const axios = require('axios');  // Add axios for handling requests to Flask API

const app = express();
const PORT = 5000;
const FLASK_API_URL = 'http://localhost:5001';  // Flask API URL

// MongoDB Connection
// const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());  // Parse incoming JSON data

// User Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String },  // Add phoneNumber field to User model
});

const User = mongoose.model('User', userSchema);

// In-memory OTP storage
const otpStorage = {};

// Function to send OTP via Nodemailer
const sendOtpEmail = (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  

  const mailOptions = {
    from: 'mortal1527@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

// Function to send OTP via Twilio
const sendOtpPhone = (phoneNumber, otp) => {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.messages.create({
  body: `Your OTP is ${otp}`,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phoneNumber,
})
.then(message => console.log('SMS sent: ' + message.sid))
.catch(error => console.log(error));
}

// Signup Route
app.post('/signup', async (req, res) => {
  const { email, password, phoneNumber } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, phoneNumber });
    await newUser.save();

    res.send({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Signup error', error);
    res.status(500).send({ success: false, message: 'Internal server error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.send({ success: false, message: 'User does not exist' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send({ success: false, message: 'Incorrect password' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = { otp, type: 'email' };

    sendOtpEmail(email, otp);

    res.send({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Login error', error);
    res.status(500).send({ success: false, message: 'Internal server error' });
  }
});

// OTP Verification Route for Email
app.post('/verify-email-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStorage[email] && otpStorage[email].type === 'email' && otpStorage[email].otp.toString() === otp.toString()) {
    delete otpStorage[email];
    res.send({ success: true, message: 'Email OTP verified successfully' });
  } else {
    res.send({ success: false, message: 'Invalid Email OTP' });
  }
});

// OTP Verification Route for Phone
app.post('/verify-phone-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (otpStorage[phoneNumber] && otpStorage[phoneNumber].type === 'phone' && otpStorage[phoneNumber].otp.toString() === otp.toString()) {
    delete otpStorage[phoneNumber];
    res.send({ success: true, message: 'Phone OTP verified successfully' });
  } else {
    res.send({ success: false, message: 'Invalid Phone OTP' });
  }
});

// Save Phone Number Route
app.post('/save-phone', async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {
      user.phoneNumber = phoneNumber;
      await user.save();
      res.send({ success: true, message: 'Phone number saved successfully' });
    } else {
      res.send({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Save phone error', error);
    res.status(500).send({ success: false, message: 'Internal server error' });
  }
});

// Send Phone OTP Route
app.post('/send-phone-otp', (req, res) => {
  const { phoneNumber } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStorage[phoneNumber] = { otp, type: 'phone' };

  sendOtpPhone(phoneNumber, otp);

  res.send({ success: true, message: 'OTP sent to your phone number' });
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



