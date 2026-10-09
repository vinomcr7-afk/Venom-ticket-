
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1556066421757317130";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

const commands = [
  new SlashCommandBuilder()
    .setName("addproduct")
    .setDescription("Add a product to VENOM SHOP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName("name")
        .setDescription("Product name")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("price")
        .setDescription("Product price, e.g. 500 DA")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("description")
        .setDescription("Product description")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("image")
        .setDescription("Direct URL of product image")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse VENOM SHOP products"),

].map(c => c.toJSON());

function buyRow(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`buyproduct:${messageId}`)
      .setLabel("شراء المنتج")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success)
  );
}

function closeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close-ticket")
      .setLabel("إغلاق التذكرة")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

client.once(Events.ClientReady, async () => {
  console.log(`VENOM SHOP online: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        GUILD_ID
      ),
      { body: commands }
    );

    console.log("VENOM SHOP commands registered!");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("interactionCreate", async interaction => {
  try {
    // ADD PRODUCT
    if (interaction.isChatInputCommand() &&
        interaction.commandName === "addproduct") {

      const name = interaction.options.getString("name");
      const price = interaction.options.getString("price");
      const description =
        interaction.options.getString("description");
      const image = interaction.options.getString("image");

      let parsedURL;

      try {
        parsedURL = new URL(image);
      } catch {
        return interaction.reply({
          content: "❌ رابط الصورة غير صالح.",
          ephemeral: true
        });
      }

      if (!["http:", "https:"].includes(parsedURL.protocol)) {
        return interaction.reply({
          content: "❌ استعمل رابط صورة يبدأ بـ https://",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x008cff)
        .setTitle(name.slice(0, 256))
        .setDescription(description.slice(0, 4000))
        .addFields({
          name: "💰 السعر",
          value: price.slice(0, 1000),
          inline: true
        })
        .setImage(image)
        .setFooter({ text: "VENOM_PRODUCT" });

      await interaction.reply({ embeds: [embed] });

      const productMessage = await interaction.fetchReply();

      await productMessage.edit({
        components: [buyRow(productMessage.id)]
      });

      return;
    }

    // SHOP MENU
    if (interaction.isChatInputCommand() &&
        interaction.commandName === "shop") {

      await interaction.deferReply({ ephemeral: true });

      const messages = await interaction.channel.messages.fetch({
        limit: 100
      });

      const products = messages
        .filter(m =>
          m.author.id === client.user.id &&
          m.embeds.some(e =>
            e.footer?.text === "VENOM_PRODUCT"
          )
        )
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .first(25);

      if (!products.length) {
        return interaction.editReply(
          "📦 لا توجد منتجات في هذا الروم. استعمل /addproduct أولًا."
        );
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("shop-select-product")
        .setPlaceholder("🛍️ اختَر منتجًا")
        .addOptions(products.map(message => ({
          label: (message.embeds[0].title || "Product").slice(0, 100),
          description: (
            message.embeds[0].fields?.[0]?.value || "عرض المنتج"
          ).slice(0, 100),
          value: message.id
        })));

      return interaction.editReply({
        content: "🛒 **ᴠᴇɴᴏᴍ SHOP**\nاختَر منتجًا لمشاهدة تفاصيله وصورته:",
        components: [
          new ActionRowBuilder().addComponents(menu)
        ]
      });
    }

    // SELECT A PRODUCT
    if (interaction.isStringSelectMenu() &&
        interaction.customId === "shop-select-product") {

      const productMessage =
        await interaction.channel.messages.fetch(interaction.values[0]);

      const productEmbed = productMessage.embeds[0];

      if (!productEmbed ||
          productEmbed.footer?.text !== "VENOM_PRODUCT") {
        return interaction.reply({
          content: "❌ هذا المنتج غير متوفر.",
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [EmbedBuilder.from(productEmbed)],
        components: [buyRow(productMessage.id)],
        ephemeral: true
      });
    }

    // BUY PRODUCT: CREATE PRIVATE TICKET
    if (interaction.isButton() &&
        interaction.customId.startsWith("buyproduct:")) {

      await interaction.deferReply({ ephemeral: true });

      const productId =
        interaction.customId.slice("buyproduct:".length);

      const productMessage =
        await interaction.channel.messages.fetch(productId);

      const product = productMessage.embeds[0];

      if (!product ||
          product.footer?.text !== "VENOM_PRODUCT") {
        return interaction.editReply("❌ المنتج غير موجود.");
      }

      const guild = interaction.guild;

      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.name.startsWith(`ticket-${interaction.user.id}-`)
      );

      if (existing) {
        return interaction.editReply(
          `عندك تذكرة مفتوحة بالفعل: ${existing}`
        );
      }

      const safeName = (product.title || "product")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 18) || "product";

      const overwrites = [
        {
          id: guild.id,
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
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ];

      if (STAFF_ROLE_ID) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const ticket = await guild.channels.create({
        name: `ticket-${interaction.user.id}-${safeName}`,
        type: ChannelType.GuildText,
        topic: `VENOM_TICKET_OWNER=${interaction.user.id}`,
        permissionOverwrites: overwrites
      });

      const ticketEmbed = EmbedBuilder.from(product)
        .setFooter({ text: "VENOM SHOP • Purchase Request" });

      await ticket.send({
        content: `${interaction.user} مرحبًا! 🎟️\nطلب شراء جديد. الإدارة ستتواصل معك هنا.`,
        embeds: [ticketEmbed],
        components: [closeRow()]
      });

      return interaction.editReply(
        `✅ تم فتح تذكرة شراء المنتج: ${ticket}`
      );
    }

    // CLOSE TICKET
    if (interaction.isButton() &&
        interaction.customId === "close-ticket") {

      const channel = interaction.channel;
      const match = channel.topic?.match(
        /VENOM_TICKET_OWNER=(\d+)/
      );

      const isOwner = match?.[1] === interaction.user.id;
      const isAdmin = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageChannels
      );

      if (!isOwner && !isAdmin) {
        return interaction.reply({
          content: "❌ فقط صاحب التذكرة أو الإدارة يمكنه إغلاقها.",
          ephemeral: true
        });
      }

      await interaction.reply("🔒 سيتم إغلاق التذكرة بعد 3 ثوانٍ.");

      setTimeout(async () => {
        try {
          await channel.delete("VENOM ticket closed");
        } catch (error) {
          console.error("Ticket deletion failed:", error);
        }
      }, 3000);
    }
  } catch (error) {
    console.error("Interaction error:", error);

    const message = "❌ وقع خطأ. تأكد من صلاحيات البوت وإعداداته.";

    if (interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred) {
      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.followUp({
        content: message,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
