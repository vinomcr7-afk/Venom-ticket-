
// VENOM SHOP - Discord.js v14
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ChannelType, PermissionFlagsBits,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '';
const SHOP_BANNER_URL = process.env.SHOP_BANNER_URL || '';
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DATA_FILE = path.join(DATA_DIR, 'venom-products.json');

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID');
  process.exit(1);
}

const defaults = [
  { id: 'kit-blue-laptop', name: 'Electronic Kit + Blue Laptop', price: 100, stock: 10, image: '' },
  { id: 'advanced-decry', name: 'Advanced Decry + Plasma Cutter', price: 150, stock: 8, image: '' },
  { id: 'thermite-c4', name: 'Thermite + C4 Charge + BasicDecrypter', price: 200, stock: 5, image: '' },
  { id: 'lighter-drill', name: 'Lighter + Security Card A + Large Drill', price: 75, stock: 12, image: '' },
];

function loadProducts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(data)) return new Map(data.map(p => [p.id, p]));
    }
  } catch (e) {
    console.error('Product data load error:', e);
  }
  return new Map(defaults.map(p => [p.id, p]));
}

let products = loadProducts();

function saveProducts() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...products.values()], null, 2));
  } catch (e) {
    console.error('Product data save error:', e);
  }
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40)
    || `product-${Date.now().toString(36)}`;
}

function isStaff(i) {
  if (i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(STAFF_ROLE_ID && i.member?.roles?.cache?.has(STAFF_ROLE_ID));
}

function shopEmbed() {
  const e = new EmbedBuilder()
    .setColor(0x168CFF)
    .setTitle('🛒 VENOM SHOP')
    .setDescription('Choose a product below to place an order.');

  if (SHOP_BANNER_URL) e.setImage(SHOP_BANNER_URL);

  const list = [...products.values()].slice(0, 25);
  if (!list.length) {
    e.addFields({
      name: 'No products',
      value: 'Staff can add products with /addproduct.',
    });
  }

  for (const p of list) {
    e.addFields({
      name: p.name,
      value: `Price: **${p.price}**\nStock: **${p.stock}**\nID: \`${p.id}\``,
      inline: true,
    });
  }
  return e;
}

function shopComponents() {
  const list = [...products.values()].filter(p => p.stock > 0).slice(0, 25);
  if (!list.length) return [];

  const menu = new StringSelectMenuBuilder()
    .setCustomId('venom_product_select')
    .setPlaceholder('Choose a product')
    .addOptions(list.map(p => ({
      label: p.name.slice(0, 100),
      description: `Price: ${p.price} | Stock: ${p.stock}`.slice(0, 100),
      value: p.id,
    })));

  return [new ActionRowBuilder().addComponents(menu)];
}

const commands = [
  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Publish the VENOM support and shop panel'),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View available products'),

  new SlashCommandBuilder()
    .setName('addproduct')
    .setDescription('Add a product')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Product name').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('Product price').setRequired(true).setMinValue(0))
    .addIntegerOption(o => o.setName('stock').setDescription('Available stock').setRequired(true).setMinValue(0))
    .addStringOption(o => o.setName('image').setDescription('Optional direct image URL').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setstock')
    .setDescription('Update product stock')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('product_id').setDescription('Product ID').setRequired(true))
    .addIntegerOption(o => o.setName('quantity').setDescription('New quantity').setRequired(true).setMinValue(0)),

  new SlashCommandBuilder()
    .setName('removeproduct')
    .setDescription('Remove a product')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('product_id').setDescription('Product ID').setRequired(true)),
].map(c => c.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`Registered guild commands: ${GUILD_ID}`);
  } else {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Registered global commands; they can take a while to appear.');
  }
}

async function createPrivateChannel(guild, name, userId) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  if (STAFF_ROLE_ID) {
    overwrites.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    reason: 'VENOM SHOP ticket',
  });
}

client.on('interactionCreate', async i => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'ticketpanel') {
        const e = new EmbedBuilder()
          .setColor(0x168CFF)
          .setTitle('💙 VENOM SHOP | SUPPORT')
          .setDescription(
            'Press **GO TO SHOP** to browse products or ' +
            '**OPEN SUPPORT** to contact the team.'
          );

        if (SHOP_BANNER_URL) e.setImage(SHOP_BANNER_URL);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('venom_open_shop')
            .setLabel('GO TO SHOP')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('venom_open_support')
            .setLabel('OPEN SUPPORT')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Secondary),
        );

        await i.reply({ content: '✅ Panel published.', ephemeral: true });
        await i.channel.send({ embeds: [e], components: [row] });
        return;
      }

      if (i.commandName === 'shop') {
        await i.reply({
          embeds: [shopEmbed()],
          components: shopComponents(),
          ephemeral: true,
        });
        return;
      }

      if (['addproduct', 'setstock', 'removeproduct'].includes(i.commandName)) {
        if (!isStaff(i)) {
          await i.reply({ content: '❌ Staff only.', ephemeral: true });
          return;
        }

        if (i.commandName === 'addproduct') {
          const name = i.options.getString('name', true).trim();
          const price = i.options.getNumber('price', true);
          const stock = i.options.getInteger('stock', true);
          const image = i.options.getString('image') || '';
          const id = slugify(name);

          if (products.has(id)) {
            await i.reply({
              content: `❌ Product ID \`${id}\` already exists. Use a different name.`,
              ephemeral: true,
            });
            return;
          }

          if (image && !/^https?:\/\/\S+$/i.test(image)) {
            await i.reply({
              content: '❌ Image must be a direct http/https URL.',
              ephemeral: true,
            });
            return;
          }

          products.set(id, { id, name, price, stock, image });
          saveProducts();
          await i.reply({
            content: `✅ Added **${name}**. Product ID: \`${id}\``,
            ephemeral: true,
          });
          return;
        }

        if (i.commandName === 'setstock') {
          const id = i.options.getString('product_id', true);
          const quantity = i.options.getInteger('quantity', true);
          const p = products.get(id);

          if (!p) {
            await i.reply({
              content: `❌ Product not found: \`${id}\``,
              ephemeral: true,
            });
            return;
          }

          p.stock = quantity;
          saveProducts();
          await i.reply({
            content: `✅ Stock for **${p.name}** is now **${quantity}**.`,
            ephemeral: true,
          });
          return;
        }

        const id = i.options.getString('product_id', true);
        const p = products.get(id);

        if (!p) {
          await i.reply({
            content: `❌ Product not found: \`${id}\``,
            ephemeral: true,
          });
          return;
        }

        products.delete(id);
        saveProducts();
        await i.reply({
          content: `✅ Removed **${p.name}**.`,
          ephemeral: true,
        });
        return;
      }
    }

    if (i.isButton()) {
      if (i.customId === 'venom_open_shop') {
        await i.reply({
          embeds: [shopEmbed()],
          components: shopComponents(),
          ephemeral: true,
        });
        return;
      }

      if (i.customId === 'venom_open_support') {
        if (!i.guild) {
          await i.reply({ content: 'Use this in a server.', ephemeral: true });
          return;
        }

        const name = `support-${slugify(i.user.username).slice(0, 24) || 'user'}`;
        const channel = await createPrivateChannel(i.guild, name, i.user.id);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('venom_close_ticket')
            .setLabel('Close ticket')
            .setStyle(ButtonStyle.Danger),
        );

        await channel.send({
          content: `${i.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ''}`,
          embeds: [
            new EmbedBuilder()
              .setColor(0x168CFF)
              .setTitle('🎫 VENOM SUPPORT')
              .setDescription('Describe your question here. Staff will help you soon.'),
          ],
          components: [row],
        });

        await i.reply({
          content: `✅ Support ticket created: ${channel}`,
          ephemeral: true,
        });
        return;
      }

      if (i.customId === 'venom_close_ticket' || i.customId === 'venom_close_order') {
        if (!i.guild || !i.channel) {
          await i.reply({ content: 'Not available here.', ephemeral: true });
          return;
        }

        const allowed = isStaff(i) ||
          i.channel.permissionOverwrites.cache.has(i.user.id);

        if (!allowed) {
          await i.reply({ content: '❌ You cannot close this ticket.', ephemeral: true });
          return;
        }

        await i.reply({ content: '🔒 Ticket will be deleted in 5 seconds.' });
        const channel = i.channel;
        setTimeout(() => channel.delete('Ticket closed').catch(() => {}), 5000);
        return;
    }
          
      if (i.customId.startsWith('venom_paid_')) {
        if (!isStaff(i)) {
          await i.reply({ content: '❌ Only staff can confirm payment.', ephemeral: true });
          return;
        }

        const parts = i.customId.split('_');
        const customerId = parts.pop();
        const quantity = Number(parts.pop());
        const productId = parts.slice(2).join('_');
        const p = products.get(productId);

        if (!p) {
          await i.reply({ content: '❌ Product not found.', ephemeral: true });
          return;
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
          await i.reply({ content: '❌ Invalid quantity.', ephemeral: true });
          return;
        }

        if (p.stock < quantity) {
          await i.reply({
            content: `❌ Not enough stock. Current stock: ${p.stock}`,
            ephemeral: true,
          });
          return;
        }

        p.stock -= quantity;
        saveProducts();

        const embed = EmbedBuilder.from(i.message.embeds[0])
          .setColor(0x2ECC71)
          .spliceFields(5, 1, {
            name: '📌 Status',
            value: '✅ Payment confirmed',
          });

        await i.update({ embeds: [embed], components: [] });

        try {
          const customer = await client.users.fetch(customerId);
          await customer.send(
            `✅ Payment confirmed for your VENOM SHOP order.\n` +
            `Product: ${p.name}\nQuantity: ${quantity}\nRemaining stock: ${p.stock}`
          );
        } catch {
          console.warn(`Could not DM customer ${customerId}.`);
        }
        return;
      }
    }

    if (i.isStringSelectMenu() && i.customId === 'venom_product_select') {
      const id = i.values[0];
      const p = products.get(id);

      if (!p || p.stock < 1) {
        await i.reply({
          content: '❌ Out of stock. Refresh /shop and try again.',
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`venom_quantity_${id}`)
        .setTitle('Choose quantity');

      const input = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel(`Quantity (stock: ${p.stock})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      return;
    }

    if (i.isModalSubmit() && i.customId.startsWith('venom_quantity_')) {
      const id = i.customId.slice('venom_quantity_'.length);
      const p = products.get(id);
      const quantity = Number(i.fields.getTextInputValue('quantity'));

      if (!p) {
        await i.reply({ content: '❌ Product not found.', ephemeral: true });
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > p.stock) {
        await i.reply({
          content: `❌ Enter a whole number from 1 to ${p.stock}.`,
          ephemeral: true,
        });
        return;
      }

      if (!i.guild) {
        await i.reply({ content: 'Place orders inside the Discord server.', ephemeral: true });
        return;
      }

      await i.deferReply({ ephemeral: true });

      let ticket;
      try {
        ticket = await createPrivateChannel(
          i.guild,
          `order-${slugify(i.user.username).slice(0, 20) || 'user'}`,
          i.user.id
        );
      } catch (e) {
        console.error('Could not create order channel:', e);
        await i.editReply('❌ Could not create order ticket. Check bot permissions.');
        return;
      }

      const total = p.price * quantity;
      const embed = new EmbedBuilder()
        .setColor(0x168CFF)
        .setTitle('📦 VENOM SHOP — ORDER')
        .addFields(
          { name: '👤 Customer', value: `<@${i.user.id}>` },
          { name: '🛒 Product', value: p.name },
          { name: '🔢 Quantity', value: String(quantity), inline: true },
          { name: '💰 Unit price', value: String(p.price), inline: true },
          { name: '💳 Total', value: `**${total}**`, inline: true },
          { name: '📌 Status', value: '⏳ Waiting for staff to confirm payment' },
        )
        .setFooter({ text: `Product ID: ${id} | Customer ID: ${i.user.id}` });

      if (p.image) embed.setThumbnail(p.image);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venom_paid_${id}_${quantity}_${i.user.id}`)
          .setLabel('Confirm payment')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('venom_close_order')
          .setLabel('Close ticket')
          .setStyle(ButtonStyle.Secondary),
      );

      await ticket.send({
        content: `${i.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ''}`,
        embeds: [embed],
        components: [row],
      });

      try {
        await i.user.send(
          `🛒 Your VENOM SHOP order was created.\n` +
          `Product: ${p.name}\nQuantity: ${quantity}\nTotal: ${total}\nTicket: ${ticket.name}`
        );
      } catch {
        console.warn(`Could not DM customer ${i.user.id}.`);
      }

      await i.editReply(`✅ Your order ticket has been created: ${ticket}`);
      return;
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const message = '❌ Something went wrong. Check Railway logs and bot permissions.';

    try {
      if (i.deferred || i.replied) {
        await i.followUp({ content: message, ephemeral: true });
      } else {
        await i.reply({ content: message, ephemeral: true });
      }
    } catch {}
  }
});

client.once('ready', () => {
  console.log(`VENOM SHOP online as ${client.user.tag}`);
});

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();
      ctMatch = channel.topic?.match(/VENOM_PRODUCT=([^;]+)/);

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
  (channel.topic || "").replace(
    "VENOM_PAID=0",
    "VENOM_PAID=1"
  )
);
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

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log('VENOM SHOP commands registered!');
}

client.once('ready', () => {
  console.log(`VENOM SHOP Online: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    // Publish shop panel
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'ticketpanel'
    ) {
      const embed = new EmbedBuilder()
        .setColor(0x168CFF)
        .setTitle('🛒 SHOP & SUPPORT')
        .setDescription(
          'Bienvenue dans VENOM SHOP !\n\n' +
          '🛒 Cliquez sur GO TO SHOP pour voir les produits.\n' +
          '💳 Choisissez votre produit et la quantité.\n' +
          '🎫 Un ticket privé sera créé pour votre commande.\n\n' +
          'Respectez le staff et évitez le spam.'
        )
        .setFooter({ text: 'VENOM SHOP • Support & Orders' });

      await interaction.reply({
        embeds: [embed],
        components: shopComponents()
      });
      return;
    }

    // Show shop
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'shop'
    ) {
      await interaction.reply({
        embeds: [makeShopEmbed()],
        components: shopComponents(),
        ephemeral: true
      });
      return;
    }

    // Add product
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'addproduct'
    ) {
      const name = interaction.options.getString('name', true);
      const price = interaction.options.getNumber('price', true);
      const stock = interaction.options.getInteger('stock', true);

      const id = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || `product-${Date.now()}`;

      if (products.has(id)) {
        await interaction.reply({
          content: `هذا المنتج موجود مسبقًا: ${id}`,
          ephemeral: true
        });
        return;
      }

      products.set(id, {
        name,
        price,
        stock,
        image: ''
      });

      await interaction.reply({
        content: `✅ تمت إضافة المنتج: ${name}\nID: ${id}`,
        ephemeral: true
      });
      return;
    }

    // Update stock
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'setstock'
    ) {
      const id = interaction.options.getString('product_id', true);
      const quantity = interaction.options.getInteger('quantity', true);
      const product = products.get(id);

      if (!product) {
        await interaction.reply({
          content: '❌ المنتج غير موجود. تحقق من ID.',
          ephemeral: true
        });
        return;
      }

      product.stock = quantity;

      await interaction.reply({
        content: `✅ مخزون ${product.name}: ${quantity}`,
        ephemeral: true
      });
      return;
    }

    // Remove product
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'removeproduct'
    ) {
      const id = interaction.options.getString('product_id', true);

      if (!products.has(id)) {
        await interaction.reply({
          content: '❌ المنتج غير موجود.',
          ephemeral: true
        });
        return;
      }

      const name = products.get(id).name;
      products.delete(id);

      await interaction.reply({
        content: `🗑️ تم حذف ${name}`,
        ephemeral: true
      });
      return;
    }

    // Refresh shop buttons
    if (
      interaction.isButton() &&
      [
        'venom_shop_refresh',
        'venom_shop_prices'
      ].includes(interaction.customId)
    ) {
      await interaction.reply({
        embeds: [makeShopEmbed()],
        components: shopComponents(),
        ephemeral: true
      });
      return;
    }

    // Product selection
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'venom_product_select'
    ) {
      const id = interaction.values[0];
      const product = products.get(id);

      if (!product || product.stock < 1) {
        await interaction.reply({
          content: '❌ هذا المنتج غير متوفر.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x168CFF)
        .setTitle(`🛒 ${product.name}`)
        .setDescription(
          `السعر: **${product.price}**\n` +
          `المخزون: **${product.stock}**\n\n` +
          'اضغط على الزر لاختيار الكمية.'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`venom_order_${id}`)
          .setLabel('🛒 Commander / Order')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      return;
    }
  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ حدث خطأ. راجع سجلات Railway.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error('Startup error:', error);
    process.exit(1);
  });
        

    // Order button: ask the customer for quantity
    if (
      interaction.isButton() &&
      interaction.customId.startsWith('venom_order_')
    ) {
      const productId = interaction.customId.slice(
        'venom_order_'.length
      );

      const product = products.get(productId);

      if (!product || product.stock < 1) {
        await interaction.reply({
          content: '❌ المنتج غير متوفر.',
          ephemeral: true
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`venom_quantity_${productId}`)
        .setTitle('اختيار الكمية');

      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('كم قطعة تريد؟')
        .setPlaceholder('مثال: 2')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(5);

      modal.addComponents(
        new ActionRowBuilder().addComponents(quantityInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Process the selected quantity and create a private order ticket
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith('venom_quantity_')
    ) {
      const productId = interaction.customId.slice(
        'venom_quantity_'.length
      );

      const product = products.get(productId);
      const quantity = Number(
        interaction.fields.getTextInputValue('quantity')
      );

      if (!product) {
        await interaction.reply({
          content: '❌ المنتج غير موجود.',
          ephemeral: true
        });
        return;
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > product.stock
      ) {
        await interaction.reply({
          content: `❌ الكمية غير صحيحة. المخزون المتاح: ${product.stock}`,
          ephemeral: true
        });
        return;
      }

      const guild = interaction.guild;

      if (!guild) {
        await interaction.reply({
          content: 'يجب طلب المنتج من داخل السيرفر.',
          ephemeral: true
        });
        return;
      }

      const total = product.price * quantity;
      const safeName = interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 20) || 'client';

      const permissions = [
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
        }
      ];

      if (STAFF_ROLE_ID) {
        const staffRole = guild.roles.cache.get(STAFF_ROLE_ID);

        if (staffRole) {
          permissions.push({
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }
      }

      const ticket = await guild.channels.create({
        name: `order-${safeName}-${Date.now().toString().slice(-4)}`,
        type: ChannelType.GuildText,
        permissionOverwrites: permissions,
        reason: 'VENOM SHOP customer order'
      });

      const embed = new EmbedBuilder()
        .setColor(0x168CFF)
        .setTitle('📦 VENOM SHOP — ORDER')
        .addFields(
          {
            name: '👤 الزبون',
            value: `<@${interaction.user.id}>`
          },
          {
            name: '🛒 المنتج',
            value: product.name
          },
          {
            name: '🔢 الكمية',
            value: String(quantity),
            inline: true
          },
          {
            name: '💰 سعر القطعة',
            value: String(product.price),
            inline: true
          },
          {
            name: '💳 المجموع',
            value: `**${total}**`,
            inline: true
          },
          {
            name: '📌 الحالة',
            value: 'في انتظار تأكيد الدفع'
          }
        )
        .setFooter({
          text: `Product ID: ${productId}`
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `venom_paid_${productId}_${quantity}_${interaction.user.id}`
          )
          .setLabel('تأكيد الدفع')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('venom_close_order')
          .setLabel('إغلاق التذكرة')
          .setStyle(ButtonStyle.Secondary)
      );

      await ticket.send({
        content: STAFF_ROLE_ID
          ? `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`
          : `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [buttons]
      });

      await interaction.reply({
        content: `✅ تم إنشاء تذكرة طلبك: ${ticket}`,
        ephemeral: true
      });

      return;
            }
            
