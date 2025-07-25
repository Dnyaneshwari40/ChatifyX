require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Message = require('./models/Message');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

let onlineUsers = {};

io.on('connection', async (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Login
  socket.on('login', async (username) => {
    socket.username = username;
    onlineUsers[socket.id] = username;

    console.log('✅ Logged in:', username);
    io.emit('online_users', Object.values(onlineUsers));

    // Private message history
    const messages = await Message.find({
      $or: [{ username }, { receiver: username }]
    }).sort({ createdAt: 1 }).lean();
    socket.emit('receive_message_history', messages);

    // Group messages
    const groupMessages = await Message.find({ group: { $exists: true } }).sort({ createdAt: 1 }).lean();
    socket.emit('receive_group_history', groupMessages);
  });

  // Join a group
  socket.on('join_group', (groupName) => {
    socket.join(groupName);
    console.log(`👥 ${socket.username} joined group: ${groupName}`);
  });

  // Private message
  socket.on('send_message', async (data) => {
    const newMsg = new Message(data);
    await newMsg.save();

    for (let [id, name] of Object.entries(onlineUsers)) {
      if (name === data.receiver || name === data.username) {
        io.to(id).emit('receive_message', data);
      }
    }
  });

  // Group message
  socket.on('send_group_message', async (data) => {
    const newMsg = new Message(data);
    await newMsg.save();

    io.to(data.group).emit('receive_group_message', data);
  });

  // Typing
  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  // ✅ Edit message in MongoDB and notify clients
  socket.on('edit_message', async (updated) => {
    try {
      await Message.findOneAndUpdate({ id: updated.id }, { message: updated.message });
      io.emit('message_edited', updated);
    } catch (err) {
      console.error('Edit failed:', err);
    }
  });

  // ✅ Delete message from MongoDB and notify clients
  socket.on('delete_message', async (id) => {
    try {
      await Message.findOneAndDelete({ id });
      io.emit('message_deleted', id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.username);
    delete onlineUsers[socket.id];
    io.emit('online_users', Object.values(onlineUsers));
  });
});

// Start server
server.listen(5000, () => {
  console.log('🚀 Server running at http://localhost:5000');
});
