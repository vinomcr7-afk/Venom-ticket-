
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
  PermissionFlagsBits
} = require("discord.js");

const fs = require("node:fs/promises");
const path = require("node:path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1556066421757317130";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";
const BANNER_URL = process.env.SHOP_BANNER_URL || "";

const DATA_FILE = path.join(__dirname, "products.json");
const MAX_PRODUCTS = 15;

let products = [];

const categories = [
  { name: "ألعاب", value: "games" },
  { name: "اشتراكات", value: "subscriptions" },
  { name: "حسابات", value: "accounts" },
  { name: "أخرى", value: "other" }
];

function categoryName(value) {
  return categories.find(c => c.value === value)?.name || "أخرى";
}

function validURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function loadProducts() {
  try {
    products = JSON.parse(
      await fs.readFile(DATA_FILE, "utf8")
    );

    if (!Array.isArray(products)) products = [];
    products = products.slice(0, MAX_PRODUCTS);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Products file error:", error);
    }

    products = [];
    await saveProducts();
  }
}

async function saveProducts() {
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(products, null, 2),
    "utf8"
  );
}

function productEmbed(product) {
  return new EmbedBuilder()
    .setColor(0x087DFF)
    .setTitle(`⚡ ${product.name}`.slice(0, 256))
    .setDescription(product.description.slice(0, 4000))
    .addFields(
      {
        name: "💰 السعر",
        value: product.price,
        inline: true
      },
      {
        name: "📦 المتوفر",
        value: `${product.stock}`,
        inline: true
      },
      {
        name: "📂 التصنيف",
        value: categoryName(product.category),
        inline: true
      }
    )
    .setImage(product.image)
    .setFooter({ text: "ᴠᴇɴᴏᴍ SHOP • ELECTRIC BLUE" });
}

function buyRow(product) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`buy:${product.id}`)
      .setLabel(product.stock > 0 ? "شراء المنتج" : "نفد المخزون")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success)
      .setDisabled(product.stock < 1)
  );
}

function paymentRow(productId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`paid:${productId}`)
      .setLabel("تأكيد استلام الدفع")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
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

function isStaff(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    ) ||
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageChannels
    ) ||
    (STAFF_ROLE_ID &&
      interaction.member?.roles?.cache?.has(STAFF_ROLE_ID))
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("addproduct")
    .setDescription("إضافة منتج جديد إلى المتجر")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("price")
        .setDescription("السعر، مثال 500 DA")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("description")
        .setDescription("وصف المنتج")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("image")
        .setDescription("رابط صورة المنتج")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("category")
        .setDescription("تصنيف المنتج")
        .setRequired(true)
        .addChoices(...categories))
    .addIntegerOption(o =>
      o.setName("stock")
        .setDescription("الكمية المتوفرة")
        .setMinValue(0)
        .setMaxValue(100000)
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("عرض متجر VENOM SHOP"),

  new SlashCommandBuilder()
    .setName("setstock")
    .setDescription("تعديل مخزون منتج")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName("stock")
        .setDescription("الكمية الجديدة")
        .setMinValue(0)
        .setMaxValue(100000)
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("removeproduct")
    .setDescription("حذف منتج من المتجر")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName("name")
        .setDescription("اسم المنتج")
        .setRequired(true))
].map(command => command.toJSON());

client.once("clientReady", async () => {
  console.log(`VENOM SHOP online: ${client.user.tag}`);

  await loadProducts();

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
    console.log(`Loaded ${products.length} products.`);
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("interactionCreate", async interaction => {
  try {
    // ADMIN COMMANDS
    if (interaction.isChatInputCommand()) {
      if (["addproduct", "setstock", "removeproduct"].includes(
        interaction.commandName
      ) && !isStaff(interaction)) {
        return interaction.reply({
          content: "❌ هذا الأمر مخصص للإدارة فقط.",
          ephemeral: true
        });
      }

      // ADD PRODUCT
      if (interaction.commandName === "addproduct") {
        if (products.length >= MAX_PRODUCTS) {
          return interaction.reply({
            content: "❌ وصل المتجر إلى الحد الأقصى: 15 منتجًا. احذف منتجًا أولًا.",
            ephemeral: true
          });
        }

        const name = interaction.options.getString("name").trim();
        const price = interaction.options.getString("price").trim();
        const description = interaction.options.getString("description").trim();
        const image = interaction.options.getString("image").trim();
        const category = interaction.options.getString("category");
        const stock = interaction.options.getInteger("stock");

        if (!name || name.length > 100 ||
            !price || price.length > 100 ||
            !description || description.length > 4000) {
          return interaction.reply({
            content: "❌ تحقق من الاسم والسعر والوصف.",
            ephemeral: true
          });
        }

        if (!validURL(image)) {
          return interaction.reply({
            content: "❌ رابط الصورة غير صالح. استعمل رابط HTTP أو HTTPS مباشر.",
            ephemeral: true
          });
        }

        if (products.some(p =>
          p.name.toLowerCase() === name.toLowerCase()
        )) {
          return interaction.reply({
            content: "❌ يوجد منتج بهذا الاسم بالفعل.",
            ephemeral: true
          });
        }

        const product = {
          id: require("node:crypto").randomUUID(),
          name,
          price,
          description,
          image,
          category,
          stock
        };

        products.push(product);
        await saveProducts();

        return interaction.reply({
          content: "✅ تمت إضافة المنتج إلى VENOM SHOP!",
          embeds: [productEmbed(product)],
          components: [buyRow(product)]
        });
      }

      // SHOP PANEL
      if (interaction.commandName === "shop") {
        if (!products.length) {
          return interaction.reply({
            content: "📦 المتجر فارغ حاليًا. ترقبوا المنتجات الجديدة!",
            ephemeral: true
          });
        }

        const panel = new EmbedBuilder()
          .setColor(0x087DFF)
          .setTitle("⚡ ᴠᴇɴᴏᴍ SHOP")
          .setDescription(
            "🛍️ مرحبًا بك في متجر VENOM!\n\n" +
            "اختر منتجًا من القائمة لمشاهدة صورته وسعره ومخزونه.\n" +
            "اضغط على زر الشراء لفتح تذكرة خاصة.\n\n" +
            `📦 عدد المنتجات: ${products.length}/${MAX_PRODUCTS}\n` +
            "💙 BLACK • ELECTRIC BLUE"
          )
          .setFooter({ text: "VENOM SHOP • Secure Order Tickets" });

        if (validURL(BANNER_URL)) {
          panel.setImage(BANNER_URL);
        }

        const select = new StringSelectMenuBuilder()
          .setCustomId("shop-select")
          .setPlaceholder("🛒 اختر منتجًا")
          .addOptions(products.map(p => ({
            label: p.name.slice(0, 100),
            description: `${p.price} • ${categoryName(p.category)}`.slice(0, 100),
            value: p.id,
            emoji: p.stock > 0 ? "📦" : "❌"
          })));

        return interaction.reply({
          embeds: [panel],
          components: [
            new ActionRowBuilder().addComponents(select)
          ]
        });
      }

      // UPDATE STOCK
      if (interaction.commandName === "setstock") {
        const name = interaction.options.getString("name");
        const stock = interaction.options.getInteger("stock");

        const product = products.find(p =>
          p.name.toLowerCase() === name.toLowerCase()
        );

        if (!product) {
          return interaction.reply({
            content: "❌ لم أجد هذا المنتج.",
            ephemeral: true
          });
        }

        product.stock = stock;
        await saveProducts();

        return interaction.reply({
          content: `✅ تم تحديث مخزون **${product.name}** إلى **${stock}**.`,
          ephemeral: true
        });
      }

      // REMOVE PRODUCT
      if (interaction.commandName === "removeproduct") {
        const name = interaction.options.getString("name");

        const product = products.find(p =>
          p.name.toLowerCase() === name.toLowerCase()
        );

        if (!product) {
          return interaction.reply({
            content: "❌ لم أجد هذا المنتج.",
            ephemeral: true
          });
        }

        const activeTicket = interaction.guild.channels.cache.find(
          channel =>
            channel.type === ChannelType.GuildText &&
            channel.topic?.includes(`VENOM_PRODUCT=${product.id}`) &&
            channel.topic?.includes("VENOM_PAID=0")
        );

        if (activeTicket) {
          return interaction.reply({
            content: "❌ لا يمكن حذف المنتج ما دامت له تذكرة شراء مفتوحة.",
            ephemeral: true
          });
        }

        products = products.filter(p => p.id !== product.id);
        await saveProducts();

        return interaction.reply({
          content: `✅ تم حذف المنتج **${product.name}** من المتجر.`,
          ephemeral: true
        });
      }
    }

    // SELECT PRODUCT
    if (interaction.isStringSelectMenu() &&
        interaction.customId === "shop-select") {
      const product = products.find(
        p => p.id === interaction.values[0]
      );

      if (!product) {
        return interaction.reply({
          content: "❌ هذا المنتج لم يعد موجودًا.",
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [productEmbed(product)],
        components: [buyRow(product)],
        ephemeral: true
      });
    }

    // BUY PRODUCT / CREATE TICKET
    if (interaction.isButton() &&
        interaction.customId.startsWith("buy:")) {
      await interaction.deferReply({ ephemeral: true });

      const productId = interaction.customId.slice(4);
      const product = products.find(p => p.id === productId);

      if (!product) {
        return interaction.editReply("❌ المنتج غير موجود.");
      }

      if (product.stock <= 0) {
        return interaction.editReply("❌ نفد مخزون هذا المنتج.");
      }

      const guild = interaction.guild;

      const existing = guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic?.includes(`VENOM_OWNER=${interaction.user.id}`) &&
        channel.topic?.includes(`VENOM_PRODUCT=${product.id}`) &&
        channel.topic?.includes("VENOM_PAID=0")
      );

      if (existing) {
        return interaction.editReply(
          `🎟️ عندك طلب مفتوح لهذا المنتج: ${existing}`
        );
      }

      const safeName = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15) || "product";

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
        name: `ticket-${interaction.user.id.slice(-5)}-${safeName}`,
        type: ChannelType.GuildText,
        topic:
          `VENOM_OWNER=${interaction.user.id};` +
          `VENOM_PRODUCT=${product.id};VENOM_PAID=0`,
        permissionOverwrites: overwrites
      });

      const orderEmbed = productEmbed(product)
        .addFields({
          name: "💳 حالة الدفع",
          value: "⏳ في انتظار تأكيد الإدارة"
        });

      await ticket.send({
        content:
          `${interaction.user} مرحبًا بك!\n` +
          "تم إنشاء طلب شراء. انتظر تعليمات الإدارة لتسديد المبلغ.\n" +
          "لا ترسل معلوماتك السرية داخل التذكرة.",
        embeds: [orderEmbed],
        components: [
          paymentRow(product.id),
          closeRow()
        ]
      });

      return interaction.editReply(
        `✅ تم فتح تذكرة الشراء: ${ticket}`
      );
    }

    // ADMIN CONFIRMS PAYMENT
    if (interaction.isButton() &&
        interaction.customId.startsWith("paid:")) {
      if (!isStaff(interaction)) {
        return interaction.reply({
          content: "❌ تأكيد الدفع مخصص للإدارة فقط.",
          ephemeral: true
        });
      }

      const channel = interaction.channel;
      const productId = interaction.customId.slice(5);
      const topic = channel.topic || "";

      if (!topic.includes(`VENOM_PRODUCT=${productId}`)) {
        return interaction.reply({
          content: "❌ هذا الزر لا يخص هذه التذكرة.",
          ephemeral: true
        });
      }

      if (topic.includes("VENOM_PAID=1")) {
        return interaction.reply({
          content: "⚠️ تم تأكيد الدفع مسبقًا.",
          ephemeral: true
        });
      }

      const product = products.find(p => p.id === productId);

      if (!product) {
        return interaction.reply({
          content: "❌ المنتج غير موجود في سجل المتجر.",
          ephemeral: true
        });
      }

      if (product.stock < 1) {
        return interaction.reply({
          content: "❌ لا توجد كمية متبقية. حدّث المخزون أولًا.",
          ephemeral: true
        });
      }

      product.stock -= 1;
      await saveProducts();

      await channel.setTopic(
        topic.replace("VENOM_PAID=0", "VENOM_PAID=1")
      );

      const oldEmbed = interaction.message.embeds[0];
      const updatedEmbed = oldEmbed
        ? EmbedBuilder.from(oldEmbed)
            .setColor(0x00C853)
            .addFields({
              name: "✅ حالة الدفع",
              value: "تم تأكيد استلام الدفع من الإدارة"
            })
        : new EmbedBuilder()
            .setColor(0x00C853)
            .setTitle("تم تأكيد الدفع");

      await interaction.update({
        content: "✅ أكدت الإدارة الدفع. تم خصم وحدة واحدة من المخزون.",
        embeds: [updatedEmbed],
        components: [
          paymentRow(productId, true),
          closeRow()
        ]
      });

      console.log(
        `Payment confirmed: ${product.name}, remaining stock: ${product.stock}`
      );

      return;
    }

    // CLOSE TICKET
    if (interaction.isButton() &&
        interaction.customId === "close-ticket") {
      const channel = interaction.channel;
      const topic = channel.topic || "";
      const owner = topic.match(/VENOM_OWNER=(\d+)/)?.[1];

      const isOwner = owner === interaction.user.id;
      const staff = isStaff(interaction);

      if (!isOwner && !staff) {
        return interaction.reply({
          content: "❌ فقط صاحب التذكرة أو الإدارة يمكنه إغلاقها.",
          ephemeral: true
        });
      }

      await interaction.reply("🔒 سيتم إغلاق التذكرة بعد 3 ثوانٍ.");

      setTimeout(async () => {
        try {
          await channel.delete("VENOM SHOP ticket closed");
        } catch (error) {
          console.error("Ticket close failed:", error);
        }
      }, 3000);
    }
  } catch (error) {
    console.error("Interaction error:", error);

    const message = "❌ حدث خطأ. تأكد من صلاحيات البوت وإعداداته.";

    if (interaction.isRepliable()) {
      if (interaction.deferred) {
        await interaction.editReply(message).catch(() => {});
      } else if (!interaction.replied) {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
});

client.login(TOKEN);
