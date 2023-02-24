require("dotenv").config();
const {
  Bot,
  InputFile,
  webhookCallback,
  HttpError,
  GrammyError,
} = require("grammy");
const ytdl = require("ytdl-core");
const regex =
  /(?:(?<=^)|(?<=\s))(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^\s/]+)(?=$|\s)/;

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

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
    .then(console.log("New user added:", ctx.from))
    .catch((e) => console.error(e));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This bot downloads YouTube shorts.\nSend a link to try it out!_",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id))
    .catch((e) => console.error(e));
});

bot.on("msg", async (ctx) => {
  console.log("Query received:", ctx.msg.text, "from", ctx.from.id);
  try {
    if (!regex.test(ctx.msg.text)) {
      await ctx.reply("*Send a valid YouTube shorts link.*", {
        parse_mode: "Markdown",
        reply_to_message_id: ctx.msg.message_id,
      });
    } else {
      const status = await ctx.reply(`*Downloading*`, {
        parse_mode: "Markdown",
      });
      const url = ctx.msg.text;
      const info = await ytdl.getInfo(url);
      const video = ytdl(url, { quality: "highest" });
      await ctx
        .replyWithVideo(new InputFile(video), {
          reply_to_message_id: ctx.msg.message_id,
        })
        .then(console.log(`Video sent successfully to ${ctx.from.id}`))
        .catch((error) => {
          console.error("Error sending video:", error);
          ctx.reply(
            "*Error sending video file.*\n_Note that videos more than 50MB are not supported._"
          );
        });
      setTimeout(async () => {
        bot.api.deleteMessage(ctx.from.id, status.message_id);
      }, 3000);
    }
  } catch (error) {
    console.error(error);
    await ctx.reply("An error occurred");
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
  ctx.reply("An error occurred");
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

export default webhookCallback(bot, "http");
