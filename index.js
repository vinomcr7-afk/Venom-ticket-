
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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const products = new Map([
  ['kit-blue-laptop', {
    name: 'Electronic Kit + Blue Laptop',
    price: 100,
    stock: 10,
    image: ''
  }],
  ['advanced-decry', {
    name: 'Advanced Decry + Plasma Cutter',
    price: 150,
    stock: 8,
    image: ''
  }],
  ['thermite-c4', {
    name: 'Thermite + C4 Charge + BasicDecrypter',
    price: 200,
    stock: 5,
    image: ''
  }],
  ['lighter-drill', {
    name: 'Lighter + Security Card A + Large Drill',
    price: 75,
    stock: 12,
    image: ''
  }]
]);

const commands = [
  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Publish the shop panel'),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View available products'),

  new SlashCommandBuilder()
    .setName('addproduct')
    .setDescription('Add a product')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Product name')
        .setRequired(true))
    .addNumberOption(o =>
      o.setName('price')
        .setDescription('Product price')
        .setRequired(true)
        .setMinValue(0))
    .addIntegerOption(o =>
      o.setName('stock')
        .setDescription('Available stock')
        .setRequired(true)
        .setMinValue(0)),

  new SlashCommandBuilder()
    .setName('setstock')
    .setDescription('Update product stock')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('product_id')
        .setDescription('Product ID')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('quantity')
        .setDescription('New quantity')
        .setRequired(true)
        .setMinValue(0)),

  new SlashCommandBuilder()
    .setName('removeproduct')
    .setDescription('Remove a product')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('product_id')
        .setDescription('Product ID')
        .setRequired(true))
].map(command => command.toJSON());

function makeShopEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x168CFF)
    .setTitle('🛒 VENOM SHOP')
    .setDescription(
      'Welcome to VENOM SHOP!\n' +
      'Choose a product, select the quantity, ' +
      'and confirm your order.'
    );

  for (const [id, product] of products) {
    embed.addFields({
      name: product.name,
      value:
        `Price: **${product.price}**\n` +
        `Stock: **${product.stock}**\n` +
        `ID: \`${id}\``
    });
  }

  return embed;
}

function shopComponents() {
  const available = [...products.entries()]
    .filter(([, product]) => product.stock > 0)
    .slice(0, 25);

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('venom_shop_refresh')
        .setLabel('🛒 GO TO SHOP')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('venom_shop_prices')
        .setLabel('💸 CHECK PRIX')
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  if (available.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('venom_product_select')
      .setPlaceholder('Choose a product')
      .addOptions(
        available.map(([id, product]) => ({
          label: product.name.slice(0, 100),
          description:
            `Price: ${product.price} | Stock: ${product.stock}`,
          value: id
        }))
      );

    rows.push(
      new ActionRowBuilder().addComponents(select)
    );
  }

  return rows;
}
e: "🗂️ الفئة", value: product.category, inline: true }
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
