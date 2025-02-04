const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const userModel = require("./models/user");
const postModel = require("./models/post");
const commentModel = require("./models/comment");
const Multerupload = require("./config/multer");
const comment = require("./models/comment");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Functions
const passwordGenerate = async function (password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (err) {
    throw ("unable to convert password to hash-password", err);
  }
};

const generateToken = function (email, userId, secret) {
  try {
    const token = jwt.sign({ email: email, userId: userId }, secret);
    return token;
  } catch (err) {
    throw ("err while creating jason web token", err);
  }
};

function isLoggedInMiddleware(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.redirect("/login");
  }

  try {
    const data = jwt.verify(req.cookies.auth_token, "secret");
    req.user = data;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}

const verifyPassword = async function (password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
};

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/register", async (req, res) => {
  try {
    const { name, age, email, username, password } = req.body;
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.redirect("/login");
    } else {
      const hashedPassword = await passwordGenerate(password);
      const user = await userModel.create({
        name,
        age,
        email,
        username,
        password: hashedPassword,
      });

      let token = generateToken(email, user._id, "secret");
      res.cookie("auth_token", token);
      res.redirect("/profile");
    }
  } catch (err) {
    console.error(err);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const isUserExisted = await userModel.findOne({ email });
    if (isUserExisted) {
      const isPasswordValid = await verifyPassword(
        password,
        isUserExisted.password
      );
      if (isPasswordValid) {
        let token = generateToken(email, isUserExisted._id, "secret");
        res.cookie("auth_token", token);
        res.redirect("/profile");
      } else {
        return res.redirect("/login");
      }
    } else {
      return res.redirect("/login");
    }
  } catch (err) {
    console.error(err);
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  res.cookie("auth_token", "", { expires: new Date(0) });
  res.redirect("/login");
});

// Post
app.get("/profile", isLoggedInMiddleware, async (req, res) => {
  const user = await userModel
    .findOne({
      email: req.user.email,
    })
    .populate("post");
  res.render("profile", { user: user });
});

app.post("/posts", isLoggedInMiddleware, async (req, res) => {
  const user = await userModel.findOne({
    email: req.user.email,
  });
  const { content } = req.body;
  const post = await postModel.create({
    user: user._id,
    content: content,
  });
  user.post.push(post._id);
  await user.save();
  res.redirect("/profile");
});

// Like
app.get("/like/:id", isLoggedInMiddleware, async (req, res) => {
  const post = await postModel
    .findOne({
      _id: req.params.id,
    })
    .populate("user");

  if (post.likes.indexOf(req.user.userId) === -1) {
    post.likes.push(req.user.userId);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userId), 1);
  }
  await post.save();
  res.redirect("/profile");
});

// Edit
app.post("/posts/edit/:id", isLoggedInMiddleware, async (req, res) => {
  const postId = req.params.id;
  const UpdatedContent = req.body.content;
  try {
    const post = await postModel.findOne({ _id: postId });
    if (!post) {
      return res.status(404).send("Something went wrong");
    }
    post.content = UpdatedContent;
    await post.save();
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Delete
app.get("/posts/delete/:id", async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    const user = await userModel.findById(post.user);
    user.post.pull(post._id);
    await user.save();

    await postModel.findOneAndDelete({
      _id: req.params.id,
    });
    res.redirect("/profile");
  } catch (err) {
    console.log(err);
  }
});

app.post(
  "/upload/profilePicture/:id",
  isLoggedInMiddleware,
  Multerupload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).send("No file uploaded.");

      const { originalname, mimetype, buffer } = req.file;
      const userId = req.params.id;
      await userModel.findByIdAndUpdate(userId, {
        profilePic: {
          filename: originalname,
          data: buffer,
          contentType: mimetype,
        },
      });
      res.redirect("/profile");
    } catch (err) {
      console.log(err);
    }
  }
);

app.get("/profilePicture/:id", isLoggedInMiddleware, async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user || !user.profilePic)
      res.status(404).send("Upload picture first...");
    res.set("Content-Type", user.profilePic.contentType);
    res.send(user.profilePic.data);
  } catch (err) {
    console.log(err);
  }
});

// Home Page
app.get("/homePage", async (req, res) => {
  try {
    const users = await userModel.find().populate("post");
    res.render("homePage", { users });
  } catch (err) {
    console.log(err);
  }
});

app.get("/home/like/:id", isLoggedInMiddleware, async (req, res) => {
  try {
    const post = await postModel
      .findById({ _id: req.params.id })
      .populate("user");
    if (post.likes.indexOf(req.user.userId) === -1) {
      post.likes.push(req.user.userId);
    } else {
      post.likes.splice(post.likes.indexOf(req.user.userId), 1);
    }
    await post.save();
    res.redirect("/homePage");
  } catch (err) {
    console.log(err);
  }
});

// Comments
app.get("/homePage/post/:id", isLoggedInMiddleware, async (req, res) => {
  try {
    const post = await postModel
      .findById({
        _id: req.params.id,
      })
      .populate("user");

    const comments = await commentModel.find({ post: req.params.id }).populate("user");

    const topLevelComments = comments.filter(
      (comment) => !comment.parentComment
    );


      topLevelComments.forEach((comment) => {
        comment.replies = comments.filter(
          (reply) =>
            reply.parentComment &&
            reply.parentComment.toString() === comment._id.toString()
        );
      });

    res.render("viewPost", { post: post, comments: topLevelComments, user: req.user });
  } catch (err) {
    console.log(err);
  }
});

app.post("/post/comment/:id", isLoggedInMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.id;

    await commentModel.create({
      user: userId,
      post: postId,
      content: req.body.comment,
    });

    res.redirect("/homePage/post/" + postId);
  } catch (err) {
    console.log(err);
  }
});

app.post("/post/comment/delete/:id", isLoggedInMiddleware, async(req, res) => {
  try{
    const comment = await commentModel.findById({_id: req.params.id}).populate('post', 'user');
    if(comment.user._id != req.user.userId){ 
      res.status(403).send("You are not authorized to delete this comment");
    }else{
      await commentModel.findByIdAndDelete(req.params.id);
      res.redirect("/homePage/post/" + comment.post._id);
    }
  }catch(err){
    console.log(err);
  }
})

app.post("/post/comment/edit/:id", isLoggedInMiddleware, async(req, res) => {
  try{
    const {editComment} = req.body;
    const comment = await commentModel.findById({_id: req.params.id}).populate('user', 'post');
    if(comment.user._id != req.user.userId){
      res.status(403).send("You are not authorized to edit this comment");
      res.redirect(`/homePage/post/${comment.post._id}`);
    }else{
      comment.content = editComment;
      await comment.save();
      res.redirect(`/homePage/post/${comment.post._id}`);
    }
  }catch(err){
    console.log(err);
  }
});

// Reply
app.post(
  "/post/comment/replyComment/:id",
  isLoggedInMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const commentId = req.params.id;
      const { replyContent } = req.body;

      const originalComment = await commentModel.findById(commentId);

      await commentModel.create({
        user: userId,
        post: originalComment.post,
        content: replyContent,
        parentComment: commentId,
      });

      res.redirect("/homePage/post/" + originalComment.post);
    } catch (err) {
      console.log(err);
    }
  }
);

app.listen(3000);
