require("dotenv").config();
const http = require("http");
const { connectDB } = require("./db");
const app = require("./app");

// create server
const server = http.createServer(app);

// server port
const PORT = process.env.PORT || 4000;

// Catch unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection: ", err);
});

// Catch exceptions not handled by try/catch in sync code.
process.on("uncaughtException", (err) => {
  console.log("Uncaught exception: ", err);
  process.exit(1);
});

const main = async () => {
  try {
    // connect db
    await connectDB();

    // Handle server-level errors (e.g., port already in use)
    server.on("error", (err) => {
      console.error("Server failed to start: ", err);
      process.exit(1);
    });

    // run server
    server.listen(PORT, () => {
      console.log("server is running");
      console.log(`API documentation: http://localhost:${PORT}/docs`);
    });
  } catch (e) {
    // catch error
    console.log("DB Connection failed");
    console.log(e.message);
    process.exit(1);
  }
};

main();
