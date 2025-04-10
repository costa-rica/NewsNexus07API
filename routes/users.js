var express = require("express");
var router = express.Router();
const { User, NewsArticleAggregatorSource } = require("newsnexus05db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

// 🔹 Register User (Create)
router.post("/register", async (req, res) => {
  const { password, email } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "password",
    "email",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: email.split("@")[0],
    password: hashedPassword,
    email,
    created: new Date(),
  });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  // const token = jwt.sign({ user }, process.env.JWT_SECRET);

  // await sendRegistrationEmail(email, username)
  //   .then(() => console.log("Email sent successfully"))
  //   .catch((error) => console.error("Email failed:", error));

  res
    .status(201)
    .json({ message: "Utilisateur créé avec succès.", user, token });
});

// 🔹 Login User (Read)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "email",
    "password",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  res.json({ message: "Utilisateur connecté avec succès.", user, token });
});

// 🔹 Send reset token POST /users/request-password-reset
router.post("/request-password-reset", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "5h",
    });
    // Reset link
    const resetLink = `${process.env.URL_KV_MANAGER_WEBSITE}/forgot-password/reset/${token}`;

    // Send email
    await sendResetPasswordEmail(email, resetLink)
      .then(() => console.log("Email sent successfully"))
      .catch((error) => console.error("Email failed:", error));

    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
