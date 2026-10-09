
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const command = new SlashCommandBuilder()
  .setName("ticket-panel")
  .setDescription("إرسال لوحة VENOM Ticket");

client.once("ready", async () => {
  console.log(`VENOM Ticket online: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: [command.toJSON()] }
    );
    console.log("Slash command registered!");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.inGuild()) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "ticket-panel") return;

    if (!interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )) {
      return interaction.reply({
        content: "❌ هذا الأمر للإدارة فقط.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle("🎟️ VENOM TICKET")
      .setDescription(
        "تحتاج مساعدة؟ اضغط على Open Ticket لفتح قناة خاصة."
      )
      .setFooter({ text: "POWER • VENOM Support" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket:open")
        .setLabel("Open Ticket")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === "ticket:open") {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const ownerId = interaction.user.id;

      const existing = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText &&
        c.topic === `ticket-owner:${ownerId}`
      );

      if (existing) {
        return interaction.editReply(
          `عندك تكت مفتوح بالفعل: ${existing}`
        );
      }

      const channel = await guild.channels.create({
        name: `ticket-${ownerId}`,
        type: ChannelType.GuildText,
        topic: `ticket-owner:${ownerId}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: ownerId,
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

      await interaction.editReply(`✅ تم فتح تكتك: ${channel}`);
    } catch (error) {
      console.error(error);
      await interaction.editReply(
        "❌ تعذر فتح التكت. تحقق من صلاحيات البوت."
      );
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
        content: "❌ ليس لديك صلاحية إغلاق هذا التكت.",
        ephemeral: true
      });
    }

    await interaction.reply("🔒 سيتم إغلاق التكت بعد 3 ثوانٍ.");

    setTimeout(() => {
      channel.delete("VENOM Ticket closed").catch(console.error);
    }, 3000);
  }
});

client.login(TOKEN);
