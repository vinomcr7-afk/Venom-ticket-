
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
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  Events
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1556066421757317130";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in Railway Variables");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DATA_FILE = path.join(__dirname, "products.json");
let products = [];
let nextOrderId = 1;

function loadProducts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      products = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (error) {
    console.error("Cannot load products:", error);
    products = [];
  }
}

function saveProducts() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

function isStaff(interaction) {
  if (!interaction.inGuild()) return false;

  const member = interaction.member;

  return (
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    (STAFF_ROLE_ID && member.roles?.cache?.has(STAFF_ROLE_ID))
  );
}

function makeShopEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x008cff)
    .setTitle("☠️ VENOM SHOP")
    .setDescription(
      products.length
        ? "اختار المنتج من القائمة لتشوف التفاصيل وتقدر تشريه."
        : "المتجر فارغ حاليًا. الإدارة تقدر تضيف منتجات باستعمال /addproduct."
    )
    .setFooter({ text: "VENOM SHOP • Secure Orders" })
    .setTimestamp();

  for (const product of products.slice(0, 15)) {
    embed.addFields({
      name: `${product.name} — ${product.price}`,
      value:
        `${product.description}\n` +
        `📦 المخزون: ${product.stock}\n` +
        `🗂️ الفئة: ${product.category}`,
      inline: false
    });
  }

  const banner = process.env.SHOP_BANNER_URL;
  if (banner && /^https?:\/\/\S+$/i.test(banner)) {
    embed.setImage(banner);
  }

  return embed;
}

const commands = [
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("عرض متجر VENOM SHOP"),

  new SlashCommandBuilder()
    .setName("addproduct")
    .setDescription("إضافة منتج جديد")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("price")
        .setDescription("سعر المنتج")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("description")
        .setDescription("وصف المنتج")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("stock")
        .setDescription("كمية المخزون")
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(option =>
      option.setName("category")
        .setDescription("فئة المنتج")
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName("image")
        .setDescription("رابط صورة المنتج (اختياري)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("setstock")
    .setDescription("تعديل مخزون منتج")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("quantity")
        .setDescription("الكمية الجديدة")
        .setRequired(true)
        .setMinValue(0)
    ),

  new SlashCommandBuilder()
    .setName("removeproduct")
    .setDescription("حذف منتج")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true)
    )
].map(command => command.toJSON());

client.once(Events.ClientReady, async readyClient => {
  console.log(`VENOM SHOP online: ${readyClient.user.tag}`);
  loadProducts();

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        readyClient.user.id,
        GUILD_ID
      ),
      { body: commands }
    );

    console.log("VENOM SHOP commands registered!");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "shop") {
        const rows = [];

        if (products.length) {
          const menu = new StringSelectMenuBuilder()
            .setCustomId("venom_select_product")
            .setPlaceholder("اختار منتجًا للشراء")
            .addOptions(
              products.slice(0, 25).map(product => ({
                label: product.name.slice(0, 100),
                description: `${product.price} • Stock: ${product.stock}`.slice(0, 100),
                value: product.id
              }))
            );

          rows.push(new ActionRowBuilder().addComponents(menu));
        }

        return interaction.reply({
          embeds: [makeShopEmbed()],
          components: rows
        });
      }

      if (interaction.commandName === "addproduct") {
        if (!isStaff(interaction)) {
          return interaction.reply({
            content: "❌ هذا الأمر للإدارة فقط.",
            ephemeral: true
          });
        }

        if (products.length >= 25) {
          return interaction.reply({
            content: "وصلت للحد الأقصى للمنتجات (25).",
            ephemeral: true
          });
        }

        const name = interaction.options.getString("name", true).trim();
        const price = interaction.options.getString("price", true).trim();
        const description = interaction.options.getString("description", true).trim();
        const stock = interaction.options.getInteger("stock", true);
        const category = interaction.options.getString("category") || "عام";
        const image = interaction.options.getString("image");
        
        if (name.length > 100 || description.length > 1000 || price.length > 100) {
          return interaction.reply({
            content: "❌ الاسم أو الوصف أو السعر طويل جدًا.",
            ephemeral: true
          });
        }

        if (image && !/^https?:\/\/\S+$/i.test(image)) {
          return interaction.reply({
            content: "❌ رابط الصورة لازم يبدأ بـ http:// أو https://",
            ephemeral: true
          });
        }

        const product = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          price,
          description,
          stock,
          category,
          image: image || ""
        };

        products.push(product);
        saveProducts();

        const embed = new EmbedBuilder()
          .setColor(0x008cff)
          .setTitle(`✅ تمت إضافة ${product.name}`)
          .setDescription(product.description)
          .addFields(
            { name: "💰 السعر", value: product.price, inline: true },
            { name: "📦 المخزون", value: String(product.stock), inline: true },
            { name: "🗂️ الفئة", value: product.category, inline: true }
          );

        if (product.image) embed.setImage(product.image);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.commandName === "setstock") {
        if (!isStaff(interaction)) {
          return interaction.reply({
            content: "❌ هذا الأمر للإدارة فقط.",
            ephemeral: true
          });
        }

        const name = interaction.options.getString("name", true);
        const quantity = interaction.options.getInteger("quantity", true);
        const product = products.find(
          p => p.name.toLowerCase() === name.toLowerCase()
        );

        if (!product) {
          return interaction.reply({
            content: "❌ لم أجد هذا المنتج. تأكد من الاسم.",
            ephemeral: true
          });
        }

        product.stock = quantity;
        saveProducts();

        return interaction.reply({
          content: `✅ مخزون **${product.name}** أصبح ${quantity}.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "removeproduct") {
        if (!isStaff(interaction)) {
          return interaction.reply({
            content: "❌ هذا الأمر للإدارة فقط.",
            ephemeral: true
          });
        }

        const name = interaction.options.getString("name", true);
        const index = products.findIndex(
          p => p.name.toLowerCase() === name.toLowerCase()
        );

        if (index === -1) {
          return interaction.reply({
            content: "❌ لم أجد هذا المنتج.",
            ephemeral: true
          });
        }

        const removed = products.splice(index, 1)[0];
        saveProducts();

        return interaction.reply({
          content: `🗑️ تم حذف المنتج **${removed.name}**.`,
          ephemeral: true
        });
      }
    }

    // Product selection
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "venom_select_product"
    ) {
      const product = products.find(p => p.id === interaction.values[0]);

      if (!product) {
        return interaction.reply({
          content: "❌ هذا المنتج لم يعد موجودًا.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x008cff)
        .setTitle(`🛒 ${product.name}`)
        .setDescription(product.description)
        .addFields(
          { name: "💰 السعر", value: product.price, inline: true },
          { name: "📦 المخزون", value: String(product.stock), inline: true },
          { name: "🗂️ الفئة", value: product.category, inline: true }
        );

      if (product.image) embed.setImage(product.image);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venom_buy_${product.id}`)
          .setLabel("شراء المنتج")
          .setEmoji("🛒")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(product.stock < 1)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }

    // Buy button: create ticket, then send DM
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("venom_buy_")
    ) {
      await interaction.deferReply({ ephemeral: true });

      const productId = interaction.customId.slice("venom_buy_".length);
      const product = products.find(p => p.id === productId);

      if (!product) {
        return interaction.editReply("❌ هذا المنتج غير موجود.");
      }

      if (product.stock < 1) {
        return interaction.editReply("❌ نفد مخزون هذا المنتج.");
      }

      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply("❌ يجب تنفيذ الشراء داخل السيرفر.");
      }

      const ticketName = `order-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 40) || `order-${interaction.user.id}`;

      const permissionOverwrites = [
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
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ];

      if (STAFF_ROLE_ID) {
        permissionOverwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        topic: `VENOM_OWNER=${interaction.user.id};VENOM_PRODUCT=${product.id};VENOM_PAID=0`,
        permissionOverwrites
      });

      const orderId = String(nextOrderId++).padStart(5, "0");

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x008cff)
        .setTitle("☠️ VENOM SHOP — طلب جديد")
        .setDescription("مرحبًا! تمت معالجة طلبك. انتظر الإدارة لتأكيد الدفع.")
        .addFields(
          { name: "🧾 رقم الطلب", value: orderId, inline: true },
          { name: "👤 الزبون", value: `<@${interaction.user.id}>`, inline: true },
          { name: "📦 المنتج", value: product.name, inline: true },
          { name: "💰 السعر", value: product.price, inline: true },
          { name: "💳 حالة الدفع", value: "⏳ في انتظار التأكيد", inline: true }
        )
        .setTimestamp();

      if (product.image) ticketEmbed.setImage(product.image);

      const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venom_paid_${orderId}`)
          .setLabel("تأكيد الدفع")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`venom_close_${orderId}`)
          .setLabel("إغلاق التذكرة")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Secondary)
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [ticketEmbed],
        components: [ticketRow]
      });

      // Send order details to the buyer's DM.
      let dmSent = true;

      try {
        await interaction.user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x008cff)
              .setTitle("🛒 VENOM SHOP — تم استلام طلبك")
              .setDescription(
                `تم إنشاء طلب الشراء بنجاح!\n\n` +
                `🧾 رقم الطلب: **${orderId}**\n` +
                `📦 المنتج: **${product.name}**\n` +
                `💰 السعر: **${product.price}**\n` +
                `⏳ الحالة: في انتظار تأكيد الدفع\n` +
                `🎟️ التذكرة: ${ticketChannel.name}`
              )
              .setTimestamp()
          ]
        });
      } catch (error) {
        dmSent = false;
        console.log("Buyer DM unavailable:", error.message);
      }

      return interaction.editReply(
        `✅ تم إنشاء تذكرة الشراء: ${ticketChannel}\n` +
        (dmSent
          ? "📩 أرسلت لك تفاصيل الطلب في الخاص."
          : "⚠️ لم أستطع مراسلتك في الخاص. افتح رسائل الخاص من إعدادات السيرفر.")
      );
    }

    // Confirm payment
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("venom_paid_")
    ) {
      if (!isStaff(interaction)) {
        return interaction.reply({
          content: "❌ تأكيد الدفع مخصص للإدارة فقط.",
          ephemeral: true
        });
      }

      const channel = interaction.channel;

      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: "❌ لا يمكن تأكيد الدفع في هذا المكان.",
          ephemeral: true
        });
      }

      if (channel.topic?.includes("VENOM_PAID=1")) {
        return interaction.reply({
          content: "⚠️ تم تأكيد الدفع مسبقًا.",
          ephemeral: true
        });
      }

      const ownerMatch = channel.topic?.match(/VENOM_OWNER=(\d+)/);
      const productMatch = channel.topic?.match(/VENOM_PRODUCT=([^;]+)/);

      if (!ownerMatch || !productMatch) {
        return interaction.reply({
          content: "❌ معلومات الطلب غير موجودة في موضوع التذكرة.",
          ephemeral: true
        });
      }

      const ownerId = ownerMatch[1];
      const product = products.find(p => p.id === productMatch[1]);

      if (!product) {
        return interaction.reply({
          content: "❌ المنتج غير موجود في المخزون الحالي.",
          ephemeral: true
        });
      }

      if (product.stock < 1) {
        return interaction.reply({
          content: "❌ المخزون فارغ. لا يمكن تأكيد هذا الطلب.",
          ephemeral: true
        });
      }

      product.stock -= 1;
      saveProducts();

      await channel.setTopic(
        channel.topic.replace("VENOM_PAID=0", "VENOM_PAID=1")
      );

      const oldEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0x00cc66)
        .addFields({
          name: "✅ حالة الدفع",
          value: `تم التأكيد بواسطة ${interaction.user}`,
          inline: false
        });

      const disabledRows = interaction.message.components.map(row =>
        new ActionRowBuilder().addComponents(
          row.components.map(component =>
            ButtonBuilder.from(component).setDisabled(true)
          )
        )
      );

      await interaction.update({
        embeds: [updatedEmbed],
        components: disabledRows
      });

      try {
        const buyer = await client.users.fetch(ownerId);
        await buyer.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00cc66)
              .setTitle("✅ VENOM SHOP — تم تأكيد الدفع")
              .setDescription(
                `تم تأكيد دفع طلبك بنجاح!\n\n` +
                `📦 المنتج: **${product.name}**\n` +
                `💰 السعر: **${product.price}**\n` +
                `📦 المخزون المتبقي: **${product.stock}**\n\n` +
                "شكرًا لثقتك في VENOM SHOP."
              )
              .setTimestamp()
          ]
        });
      } catch (error) {
        console.log("Payment DM unavailable:", error.message);
      }

      return;
    }

    // Close ticket
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("venom_close_")
    ) {
      const channel = interaction.channel;
      const ownerMatch = channel?.topic?.match(/VENOM_OWNER=(\d+)/);
      const isOwner = ownerMatch?.[1] === interaction.user.id;

      if (!isStaff(interaction) && !isOwner) {
        return interaction.reply({
          content: "❌ فقط صاحب التذكرة أو الإدارة يقدر يغلقها.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 سيتم إغلاق التذكرة بعد لحظات.",
        ephemeral: true
      });

      setTimeout(() => {
        channel?.delete("VENOM SHOP ticket closed").catch(console.error);
      }, 3000);
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ وقع خطأ. تفقّد Railway Logs.",
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.isRepliable() && interaction.deferred) {
      await interaction.editReply("❌ وقع خطأ. تفقّد Railway Logs.").catch(() => {});
    }
  }
});

client.login(TOKEN);
