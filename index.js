const PORT = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || "development";

const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const morgan = require("morgan");
const flash = require("connect-flash");

const knex = require("knex");
const knexConfig = require("./knexfile");
const knexLogger = require("knex-logger");

const db = knex(knexConfig[nodeEnv]);

const users = require("./models/User")(db);

const app = express();

app.set("view engine", "ejs");

app.use(morgan("dev"));
app.use(knexLogger(db));
app.use("/assets/", express.static("./public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  cookieSession({
    name: "session",
    keys: ["my-super-secret-password"],
    maxAge: 24 * 60 * 60 * 1000
  })
);
app.use(flash());

app.use((req, res, next) => {
  const token = req.session.token;
  const anonUser = {
    id: -1,
    username: "Anonymous"
  };

  if (token) {
    users
      .findByToken(token)
      .then(([user]) => {
        if (user) {
          req.currentUser = user;
        } else {
          req.currentUser = anonUser;
        }
      })
      .catch(() => {
        req.currentUser = anonUser;
      })
      .finally(() => {
        next();
      });
  } else {
    req.currentUser = anonUser;
    next();
  }
});

// Routes
const posts = require("./routes/posts")(db);
app.use("/posts", posts);

app.get("/", (req, res) => {
  res.render("index", {
    user: req.currentUser,
    info: req.flash("info"),
    errors: req.flash("errors")
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    user: req.currentUser,
    info: req.flash("info"),
    errors: req.flash("errors")
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "" || password === "") {
    req.flash("errors", "Please provide a username and password");
    return res.redirect("/login");
  }

  users
    .login(username, password)
    .then(user => {
      req.session.token = user.token;
      req.flash("info", "Succesfully logged in!");
      res.redirect("/");
    })
    .catch(e => {
      console.error(e);
      req.flash("errors", "Invalid username");
      res.redirect("/login");
    });
});

app.get("/logout", (req, res) => {
  req.flash("info", "Logged out succesfully!");
  req.session.token = null;
  res.redirect("/");
});

app.get("/register", (req, res) => {
  res.render("register", {
    user: req.currentUser,
    info: req.flash("info"),
    errors: req.flash("errors")
  });
});

app.post("/register", (req, res) => {
  const { username, password, password_confirm } = req.body;

  if (username === "") {
    req.flash("errors", "Username is required.");
    return res.redirect("/register");
  } else if (password === "" || password_confirm === "") {
    req.flash("errors", "Password is required");
    return res.redirect("/register");
  } else if (password !== password_confirm) {
    req.flash("errors", "Passwords must match");
    return res.redirect("/register");
  }

  users
    .register(username, password)
    .then(user => {
      // Set the session
      req.session.token = user.token;
      req.flash("info", "User succesfully registered");
      res.redirect("/");
    })
    .catch(e => {
      console.error(e);
      req.flash("errors", "Username already taken");
      res.redirect("/register");
    });
});

app.listen(PORT, () => {
  console.log(`App is now listening on http://localhost:${PORT}/`);
});
