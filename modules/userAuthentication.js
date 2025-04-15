const jwt = require("jsonwebtoken");
const { User } = require("newsnexus05db");

async function authenticateToken(req, res, next) {
  if (process.env.AUTHENTIFICATION_TURNED_OFF === "true") {
    const user = await User.findOne({
      where: { email: "nickrodriguez@kineticmetrics.com" },
    });
    req.user = user;
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) {
    return res.status(401).json({ message: "Token is required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    // console.log("-- check here");
    if (err) return res.status(403).json({ message: "Invalid token" });
    const { id } = decoded;
    const user = await User.findByPk(id);
    // console.log(user);
    req.user = user;
    next();
  });
}

async function findUserByEmail(email) {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found");
    }
    console.log(user);
    return user;
  } catch (error) {
    console.error("Error finding user by email:", error);
  }
}

// for ACCEPTED_EMAILS in .env just add "," to each new email (i.e. do not use [])
const restrictEmails = (email) => {
  const acceptedEmailsEnv = process.env.ACCEPTED_EMAILS;

  // If ACCEPTED_EMAILS is not defined or empty, return false
  if (!acceptedEmailsEnv) {
    return true;
  }

  // Convert the comma-separated string into an array of emails
  const acceptedEmails = acceptedEmailsEnv.split(",");

  // Check if the provided email exists in the list of accepted emails
  return acceptedEmails.includes(email);
};

module.exports = {
  // createToken,
  authenticateToken,
  findUserByEmail,
  restrictEmails,
};
