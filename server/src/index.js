require("dotenv").config();
const http = require("http");
const { connectDB } = require("./db");
const app = require("./app");

const server = http.createServer(app);

// run server
const main = async () => {
  try {
    await connectDB();
    server.listen(process.env.PORT || 4000, () => {
      console.log("server is running");
      console.log("API documentation: http://localhost:4000/docs");
    });
  } catch (e) {
    console.log("DB Connection failed");
    console.log(e.message);
  }
};

main();
