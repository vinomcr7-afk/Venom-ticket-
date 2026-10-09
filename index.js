
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`VENOM Ticket is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content.trim() !== "!ticket-panel") return;

  if (!message.member.permissions.has(
    PermissionFlagsBits.ManageGuild
  )) {
    return message.reply("الإدارة فقط يمكنها إنشاء لوحة التكت.");
  }

  const embed = new EmbedBuilder()
    .setColor(0x00BFFF)
    .setTitle("🎟️ VENOM TICKET")
    .setDescription("اضغط على Open Ticket لفتح تكت خاص مع الإدارة.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:open")
      .setLabel("Open Ticket")
      .setEmoji("🎟️")
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({ embeds: [embed], components: [row] });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || !interaction.guild) return;

  if (interaction.customId === "ticket:open") {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const existing = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText &&
        c.topic === `ticket-owner:${interaction.user.id}`
      );

      if (existing) {
        return interaction.editReply(`عندك تكت مفتوح: ${existing}`);
      }

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        topic: `ticket-owner:${interaction.user.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
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
          .setCustomId("ticket:close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user} مرحبًا بك! اشرح مشكلتك هنا.`,
        components: [closeRow]
      });

      await interaction.editReply(`تم فتح تكتك: ${channel}`);
    } catch (error) {
      console.error(error);
      await interaction.editReply("تعذر فتح التكت. تحقق من صلاحيات البوت.");
    }
  }

  if (interaction.customId === "ticket:close") {
    const channel = interaction.channel;
    const ownerId = channel.topic?.startsWith("ticket-owner:")
      ? channel.topic.slice("ticket-owner:".length)
      : null;

    const isOwner = interaction.user.id === ownerId;
    const isAdmin = interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageChannels
    );

    if (!isOwner && !isAdmin) {
      return interaction.reply({
        content: "ليس لديك صلاحية إغلاق هذا التكت.",
        ephemeral: true
      });
    }

    await interaction.reply("🔒 سيتم إغلاق التكت بعد 3 ثوانٍ.");
    setTimeout(() => {
      channel.delete().catch(console.error);
    }, 3000);
  }
});

client.login(process.env.DISCORD_TOKEN);
