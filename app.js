const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const userModel = require('./models/user');
const postModel = require('./models/post');


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});


// Functions
const passwordGenerate = async function(password){
  try{
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }catch(err){
    throw ("unable to convert password to hash-password", err);
  }
}

const generateToken = function(email, userId, secret){
  try {
    const token = jwt.sign({ email: email, userId: userId }, secret);
    return token;
  } catch (err) {
    throw ("err while creating jason web token", err);
  }
}

function isLoggedInMiddleware(req, res, next) {
  const token = req.cookies.auth_token;
  if(!token){
    return res.redirect('/login');
  }

  try{
    const data = jwt.verify(req.cookies.auth_token, 'secret');
    req.user = data;
    next();
  }catch(err){
    return res.redirect('/login');
  }
}

const verifyPassword = async function(password, hashedPassword){
  return await bcrypt.compare(password, hashedPassword);
}

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login');
})

app.post('/register', async(req, res) => {
  try{
    const {name, age, email, username, password} = req.body;
    const existingUser = await userModel.findOne({email});
    
    if(existingUser){
      return res.redirect('/login');
    }else{
      const hashedPassword = await passwordGenerate(password);
      const user = await userModel.create({
        name,
        age,
        email,
        username,
        password: hashedPassword,
      });

      let token = generateToken(email, user._id , 'secret')
      res.cookie('auth_token', token);
      res.redirect('/profile');
    }
  }catch(err){
    console.error(err);
  }
})



app.post('/login', async (req, res) => {
  try{
    const {email, password} = req.body;
    const isUserExisted = await userModel.findOne({email});
    if(isUserExisted){
      const isPasswordValid = await verifyPassword(password, isUserExisted.password)
      if(isPasswordValid){
        let token = generateToken(email, isUserExisted._id, 'secret');
        res.cookie('auth_token', token);
        res.redirect('/profile');
      }else{
        return res.redirect('/login'); 
      }
    }else{
      return res.redirect('/login');
    }
  }catch(err){
    console.error(err);
    res.redirect('/login');
  }
})

app.get('/logout', (req, res) => {
  res.cookie('auth_token', '', {expires: new Date(0)});
  res.redirect('/login');
})

// Post
app.get('/profile', isLoggedInMiddleware, async (req, res) => {
  const user = await userModel.findOne({
    email: req.user.email
  }).populate('post');
  res.render('profile', {user: user});
})


app.post('/posts', isLoggedInMiddleware, async(req, res) => {
  const user = await userModel.findOne({
    email: req.user.email
  });
  const {content} = req.body;
  const post = await postModel.create({
    user: user._id,
    content: content,
  });
  user.post.push(post._id);
  await user.save();
  res.redirect('/profile');
})

app.listen(3000);