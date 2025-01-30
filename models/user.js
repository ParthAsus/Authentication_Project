const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/miniProject');

const userSchema = mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  age: Number,
  username: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    unique: true
  },
  post: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'post'
    }
  ]
});

module.exports = mongoose.model('user', userSchema);