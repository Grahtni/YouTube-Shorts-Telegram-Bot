require("dotenv").config();
const {
  Bot,
  InputFile,
  webhookCallback,
  HttpError,
  GrammyError,
} = require("grammy");
const ytdl = require("ytdl-core");
//const regex =
/(?:(?<=^)|(?<=\s))(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^\s/]+)(?=$|\s)/;

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// DB

const mysql = require("mysql2");
const connection = mysql.createConnection(process.env.DATABASE_URL);

// Response

async function responseTime(ctx, next) {
  const before = Date.now();
  await next();
  const after = Date.now();
  console.log(`Response time: ${after - before} ms`);
}

bot.use(responseTime);

// Commands

bot.command("start", async (ctx) => {
  await ctx
    .reply("*Welcome!* ✨ Send a YouTube shorts link.", {
      parse_mode: "Markdown",
    })
    .then(() => {
      connection.query(
        `
SELECT * FROM users WHERE userid = ?
`,
        [ctx.from.id],
        (error, results) => {
          if (error) throw error;
          if (results.length === 0) {
            connection.query(
              `
    INSERT INTO users (userid, username, firstName, lastName, firstSeen)
    VALUES (?, ?, ?, ?, NOW())
  `,
              [
                ctx.from.id,
                ctx.from.username,
                ctx.from.first_name,
                ctx.from.last_name,
              ],
              (error, results) => {
                if (error) throw error;
                console.log("New user added:", ctx.from);
              }
            );
          } else {
            console.log("User exists in database.", ctx.from);
          }
        }
      );
    })
    .catch((error) => console.error(error));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This bot downloads YouTube shorts.\nSend a link to try it out!_",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id))
    .catch((error) => console.error(error));
});

bot.on("msg", async (ctx) => {
  console.log("Query received:", ctx.msg.text, "from", ctx.from.id);
  try {
    if (!ctx.msg.text) {
      await ctx.reply("*Send a valid YouTube shorts link.*", {
        parse_mode: "Markdown",
        reply_to_message_id: ctx.msg.message_id,
      });
    } else {
      const url = ctx.msg.text;
      const info = await ytdl.getInfo(url);
      const videoFile = ytdl(url, { quality: "highest" });
      async function sendVideo(ctx, videoFile) {
        try {
          await ctx
            .replyWithVideo(new InputFile(videoFile), {
              caption: `[${info.videoDetails.title}](${ctx.msg.text})`,
              parse_mode: "Markdown",
            })
            .then(console.log(`Video sent successfully to ${ctx.from.id}`));
        } catch (error) {
          console.error("Error sending video:", error);
          await ctx.reply(
            "*Error sending video file.*\n_Note that videos more than 50MB are not supported._",
            {
              parse_mode: "Markdown",
              reply_to_message_id: ctx.msg.message_id,
            }
          );
        }
      }
      await sendVideo(ctx, videoFile);
    }
  } catch (error) {
    if (error instanceof GrammyError) {
      console.log(`Error sending message${error.message}`);
      return;
    } else {
      console.log("An error occurred");
      await ctx.reply(`*${error}*.`, {
        parse_mode: "Markdown",
        reply_to_message_id: ctx.msg.message_id,
      });
      return;
    }
  }
});

// Error

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    "Error while handling update",
    ctx.update.update_id,
    "\nQuery:",
    ctx.msg.text
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
    if (e.description === "Forbidden: bot was blocked by the user") {
      console.log("Bot was blocked by the user");
    } else {
      ctx.reply("An error occurred");
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

export default webhookCallback(bot, "http");
