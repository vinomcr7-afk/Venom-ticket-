
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1556066421757317130";

const command = new SlashCommandBuilder()
  .setName("ticket-panel")
  .setDescription("Send the ticket panel");

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: [command.toJSON()] }
    );

    console.log("Guild slash command registered!");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() &&
      !interaction.isButton()) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "ticket-panel") return;

    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle("🎟️ VENOM TICKET")
      .setDescription("اضغط على الزر لفتح تذكرة خاصة مع فريق الإدارة.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket-open")
        .setLabel("Open Ticket")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  if (interaction.isButton() &&
      interaction.customId === "ticket-open") {
    await interaction.deferReply({ ephemeral: true });

    const existing = interaction.guild.channels.cache.find(
      channel =>
        channel.name === `ticket-${interaction.user.id}` &&
        channel.type === ChannelType.GuildText
    );

    if (existing) {
      await interaction.editReply(
        `عندك تذكرة مفتوحة بالفعل: ${existing}`
      );
      return;
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket-close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user} مرحبًا بك! اشرح مشكلتك هنا.`,
        components: [closeRow]
      });

      await interaction.editReply(
        `تم فتح تذكرتك بنجاح: ${channel}`
      );
    } catch (error) {
      console.error("Ticket creation failed:", error);
      await interaction.editReply(
        "ما قدرتش نفتح التذكرة. تأكد أن البوت عنده Manage Channels."
      );
    }
  }

  if (interaction.isButton() &&
      interaction.customId === "ticket-close") {
    const channel = interaction.channel;

    const isOwner =
      channel.name === `ticket-${interaction.user.id}`;

    const canManage = interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageChannels
    );

    if (!isOwner && !canManage) {
      await interaction.reply({
        content: "غير صاحب التذكرة أو الإدارة يقدر يغلقها.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply("🔒 سيتم إغلاق التذكرة بعد 3 ثوانٍ.");

    setTimeout(async () => {
      try {
        await channel.delete("Ticket closed");
      } catch (error) {
        console.error("Ticket close failed:", error);
      }
    }, 3000);
  }
});

client.login(TOKEN);
      
