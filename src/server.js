import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import orderRoutes from "./routes/orders.js";
import userRoutes from "./routes/users.js";

const app = express();
const root = process.cwd();
const pub = path.join(root, "public");
const pages = path.join(pub, "pages");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(pub));

app.get("/favicon.ico", (_, res) =>
  res.sendFile(path.join(pub, "static", "favicon.png")),
);

app.get("/api/config/stripe", (_, res) => {
  res.json({ publishableKey: process.env.NEXT_PUBLIC_STRIPE_KEY });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

app.get("/", (_, res) => res.sendFile(path.join(pages, "index.html")));
app.get("/pages/sell", (_, res) => res.sendFile(path.join(pages, "sell.html")));
app.get("/pages/cart", (_, res) => res.sendFile(path.join(pages, "cart.html")));
app.get("/pages/orders", (_, res) =>
  res.sendFile(path.join(pages, "orders.html")),
);
app.get("/pages/login", (_, res) =>
  res.sendFile(path.join(pages, "login.html")),
);
app.get("/pages/signup", (_, res) =>
  res.sendFile(path.join(pages, "signup.html")),
);
app.get("/pages/account", (_, res) =>
  res.sendFile(path.join(pages, "account.html")),
);
app.get("/pages/product", (_, res) =>
  res.sendFile(path.join(pages, "product.html")),
);
app.get("/pages/admin", (_, res) =>
  res.sendFile(path.join(pages, "admin.html")),
);
app.get("/pages/reset", (_, res) =>
  res.sendFile(path.join(pages, "reset.html")),
);
app.get("/admin", (_, res) => res.sendFile(path.join(pages, "admin.html")));

app.use((err, req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () =>
    console.log(`Sick Fits running → http://localhost:${PORT}`),
  );
}

export default app;
