const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  username: String,
  receiver: String,
  group: String,
  message: String,
  time: String
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
