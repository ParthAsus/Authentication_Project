const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    }
  ],
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'comment',
    default: null
  }
});

module.exports = mongoose.model('comment', commentSchema);