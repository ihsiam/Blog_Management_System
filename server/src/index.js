require("dotenv").config();
const http = require("http");
const { connectDB } = require("./db");
const app = require("./app");

// create server
const server = http.createServer(app);

// server port
const PORT = process.env.PORT || 4000;

// run server
const main = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log("server is running");
      console.log(`API documentation: http://localhost:${PORT}/docs`);
    });
  } catch (e) {
    console.log("DB Connection failed");
    console.log(e.message);
  }
};

main();
