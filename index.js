const bcrypt = require("bcrypt");

const ADMIN = {
  username: "admin",
  passwordHash: "$2b$10$lj3uectcFD.gy/EbqTBW4u3970IS.A/CLsfffnVnbhAjkHT.sQ/6W"
};

const session = require("express-session");
const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://tanmayg3011:tanmayg3011@cafebackyard.n07vpdz.mongodb.net/cafebackyard?retryWrites=true&w=majority",
  { serverSelectionTimeoutMS: 5000 }
)
.then(() => console.log("MongoDB connected"))
.catch(err => {
  console.error("MongoDB connection FAILED:");
  console.error(err.message);
});

// ── SCHEMAS ───────────────────────────────────────────────

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  userPhone: {
    type: String,
    default: ""
  },
  items: [
    {
      name: String,
      price: Number,
      qty: Number
    }
  ],
  address: String,
  totalAmount: Number,
  status: {
    type: String,
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const menuSchema = new mongoose.Schema({
  name: String,
  price: Number,
  inStock: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: ""
  }
});

const offerSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: {
    type: String,
    default: ""
  }
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    unique: true,       // one account per phone number
    required: true,
    trim: true
  },
  securityQuestion: {
    type: String,
    default: ""
  },
  securityAnswer: {
    type: String,       // stored as bcrypt hash
    default: ""
  }
});

// ── MODELS ────────────────────────────────────────────────

const User     = mongoose.model("User",     userSchema);
const Offer    = mongoose.model("Offer",    offerSchema);
const MenuItem = mongoose.model("MenuItem", menuSchema);
const Order    = mongoose.model("Order",    orderSchema);

// ── EXPRESS SETUP ─────────────────────────────────────────

const express = require("express");
const path    = require("path");
const app     = express();

app.use(express.json({ limit: "10mb" }));

app.use(session({
  secret: "cafebackyard_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: "lax" }
}));

// ── MIDDLEWARE ────────────────────────────────────────────

function requireUser(req, res, next) {
  if (req.session.userId) next();
  else res.status(401).json({ error: "Login required" });
}

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) next();
  else res.status(403).json({ error: "Admin access required" });
}

// ── MENU (PUBLIC) ─────────────────────────────────────────

app.get("/menu", async (req, res) => {
  const items = await MenuItem.find();
  res.json(items);
});

// ── OFFERS (PUBLIC) ───────────────────────────────────────

app.get("/offers", async (req, res) => {
  const offers = await Offer.find();
  res.json(offers);
});

// ── REGISTER ─────────────────────────────────────────────

app.post("/register", async (req, res) => {
  try {
    const { username, password, phone, securityQuestion, securityAnswer } = req.body;

    // ── Validation ──
    if (!username || !password || !phone) {
      return res.status(400).json({ error: "Username, password and phone are required" });
    }
    if (!securityQuestion || !securityAnswer) {
      return res.status(400).json({ error: "Security question and answer are required" });
    }

    // ── Check username uniqueness ──
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // ── Check phone uniqueness ──
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: "An account with this phone number already exists" });
    }

    // ── Hash password and security answer ──
    const passwordHash = await bcrypt.hash(password, 10);
    const answerHash   = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);

    const user = new User({
      username,
      password: passwordHash,
      phone,
      securityQuestion,
      securityAnswer: answerHash
    });

    await user.save();
    res.json({ message: "Registered successfully" });

  } catch (err) {
    console.error("Register error:", err);
    // Handle MongoDB duplicate key errors gracefully
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: field === "phone"
          ? "An account with this phone number already exists"
          : "Username already taken"
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// ── USER LOGIN ────────────────────────────────────────────

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = user._id;
    res.json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── USER LOGOUT ───────────────────────────────────────────

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// ── FORGOT PASSWORD — STEP 1: verify username + phone ────
// Returns the security question if username + phone match.

app.post("/forgot-password/verify", async (req, res) => {
  try {
    const { username, phone } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ error: "Username and phone are required" });
    }

    const user = await User.findOne({ username, phone });
    if (!user) {
      // Generic message — don't reveal which field was wrong
      return res.status(404).json({ error: "No account found with these details" });
    }

    if (!user.securityQuestion) {
      return res.status(400).json({ error: "No security question set for this account" });
    }

    res.json({ securityQuestion: user.securityQuestion });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── FORGOT PASSWORD — STEP 2: verify answer + reset ──────
// Checks the security answer, then updates the password.

app.post("/forgot-password/reset", async (req, res) => {
  try {
    const { username, phone, securityAnswer, newPassword } = req.body;

    if (!username || !phone || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ username, phone });
    if (!user) {
      return res.status(404).json({ error: "No account found with these details" });
    }

    // Verify security answer (case-insensitive, trimmed)
    const answerMatch = await bcrypt.compare(
      securityAnswer.trim().toLowerCase(),
      user.securityAnswer
    );
    if (!answerMatch) {
      return res.status(401).json({ error: "Incorrect security answer" });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successfully" });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── CREATE ORDER (USER) ───────────────────────────────────

app.post("/orders", requireUser, async (req, res) => {
  try {
    const { items, address } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items in order" });
    }
    if (!address || address.trim() === "") {
      return res.status(400).json({ error: "Delivery address required" });
    }

    let totalAmount = 0;
    items.forEach(item => { totalAmount += item.price * item.qty; });

    const orderingUser = await User.findById(req.session.userId).select("phone");

    const newOrder = new Order({
      userId:    req.session.userId,
      userPhone: orderingUser ? (orderingUser.phone || "") : "",
      items,
      address,
      totalAmount,
      status: "pending"
    });

    await newOrder.save();
    res.status(201).json({ message: "Order placed successfully", order: newOrder });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── CANCEL ORDER (USER) ───────────────────────────────────

app.patch("/orders/:id/cancel", requireUser, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status !== "pending") {
    return res.status(400).json({ error: "Order cannot be cancelled now" });
  }

  order.status = "cancelled";
  await order.save();
  res.json({ message: "Order cancelled" });
});

// ── MY ORDERS (USER) ──────────────────────────────────────

app.get("/myorders", requireUser, async (req, res) => {
  const orders = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 });
  res.json(orders);
});

// ── GET ALL ORDERS (ADMIN) ────────────────────────────────

app.get("/orders", requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// ── UPDATE ORDER STATUS (ADMIN) ───────────────────────────

app.patch("/orders/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;

  const validStatuses = ["pending","accepted","out_for_delivery","delivered","declined","cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "cancelled") {
    return res.status(400).json({ error: "Order already cancelled by user" });
  }

  order.status = status;
  await order.save();
  res.json({ message: "Order status updated", order });
});

// ── ADMIN LOGIN ───────────────────────────────────────────

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN.username) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, ADMIN.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.isAdmin = true;
  res.json({ message: "Login successful" });
});

// ── ADMIN LOGOUT ──────────────────────────────────────────

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// ── MENU MANAGEMENT (ADMIN) ───────────────────────────────

app.post("/admin/menu", requireAdmin, async (req, res) => {
  const { name, price, image } = req.body;
  const item = new MenuItem({ name, price, image: image || "", inStock: true });
  await item.save();
  res.json(item);
});

app.patch("/admin/menu/:id", requireAdmin, async (req, res) => {
  const { price, inStock } = req.body;
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  if (price   !== undefined) item.price   = price;
  if (inStock !== undefined) item.inStock = inStock;
  await item.save();
  res.json(item);
});

app.delete("/admin/menu/:id", requireAdmin, async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ message: "Item deleted" });
});

// ── OFFERS MANAGEMENT (ADMIN) ─────────────────────────────

app.post("/admin/offers", requireAdmin, async (req, res) => {
  const { title, description, price, image } = req.body;
  const offer = new Offer({ title, description, price, image: image || "" });
  await offer.save();
  res.json(offer);
});

app.delete("/admin/offers/:id", requireAdmin, async (req, res) => {
  await Offer.findByIdAndDelete(req.params.id);
  res.json({ message: "Offer deleted" });
});

// ── REVENUE (ADMIN) ───────────────────────────────────────

app.get("/admin/revenue", requireAdmin, async (req, res) => {
  const orders = await Order.find({ status: "delivered" });

  let totalRevenue = 0;
  let todayRevenue = 0;
  let monthRevenue = 0;
  const now = new Date();

  orders.forEach(order => {
    totalRevenue += order.totalAmount;
    const orderDate = new Date(order.createdAt);
    if (orderDate.toDateString() === now.toDateString()) {
      todayRevenue += order.totalAmount;
    }
    if (
      orderDate.getMonth()    === now.getMonth() &&
      orderDate.getFullYear() === now.getFullYear()
    ) {
      monthRevenue += order.totalAmount;
    }
  });

  res.json({ totalRevenue, todayRevenue, monthRevenue, totalOrders: orders.length });
});

// ── STATIC FILES ──────────────────────────────────────────

app.use(express.static(path.join(__dirname, "public")));

// ── START SERVER ──────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});