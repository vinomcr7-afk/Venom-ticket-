'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

// ==========================================
// VENOM SHOP — CONFIGURATION
// ==========================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const SHOP_BANNER_URL = process.env.SHOP_BANNER_URL;

const DATA_DIR = process.env.DATA_DIR || __dirname;
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

const RED = 0xE50914;
const BLUE = 0x168CFF;
const GREEN = 0x2ECC71;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID in Railway Variables.');
  process.exit(1);
}

// ==========================================
// CLIENT
// ==========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const products = new Map();

// ==========================================
// PRODUCTS STORAGE
// ==========================================

function loadProducts() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(PRODUCTS_FILE)) {
      fs.writeFileSync(PRODUCTS_FILE, '{}', 'utf8');
    }

    const data = JSON.parse(
      fs.readFileSync(PRODUCTS_FILE, 'utf8')
    );

    for (const [id, product] of Object.entries(data)) {
      if (!product || typeof product.name !== 'string') {
        continue;
      }

      products.set(id, {
        id,
        name: product.name,
        price: Number(product.price) || 0,
        stock: Math.max(
          0,
          Number.parseInt(product.stock, 10) || 0
        ),
        image: typeof product.image === 'string'
          ? product.image
          : '',
      });
    }

    console.log(`Loaded ${products.size} products.`);
  } catch (error) {
    console.error('Could not load products:', error);
    process.exit(1);
  }
}

function saveProducts() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const data = Object.fromEntries(products.entries());

    fs.writeFileSync(
      PRODUCTS_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );

    return true;
  } catch (error) {
    console.error('Could not save products:', error);
    return false;
  }
}

// ==========================================
// HELPERS
// ==========================================

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return slug || `product-${Date.now().toString(36)}`;
}

function isStaff(interaction) {
  if (!interaction.inGuild()) {
    return false;
  }

  if (
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )
  ) {
    return true;
  }

  if (!STAFF_ROLE_ID) {
    return false;
  }

  const roles = interaction.member?.roles;

  return Boolean(
    roles?.cache?.has(STAFF_ROLE_ID) ||
    roles?.includes?.(STAFF_ROLE_ID)
  );
}

async function requireStaff(interaction) {
  if (isStaff(interaction)) {
    return true;
  }

  await interaction.reply({
    content: '❌ هذا الأمر مخصص للإدارة فقط.',
    ephemeral: true,
  });

  return false;
}

// ==========================================
// PRIVATE TICKETS
// ==========================================

async function createPrivateChannel(guild, name, userId) {
  const permissionOverwrites = [
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
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  if (
    STAFF_ROLE_ID &&
    guild.roles.cache.has(STAFF_ROLE_ID)
  ) {
    permissionOverwrites.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  return guild.channels.create({
    name: name.slice(0, 90),
    type: ChannelType.GuildText,
    permissionOverwrites,
    reason: 'VENOM SHOP ticket',
  });
}

// ==========================================
// SHOP EMBED
// ==========================================

function shopEmbed() {
  const embed = new EmbedBuilder()
    .setColor(RED)
    .setTitle('🔴 VENOM SHOP')
    .setDescription(
      'Welcome to **VENOM SHOP**!\n\n' +
      '🛒 اختر منتجًا من القائمة لبدء الطلب.\n' +
      '🎫 اضغط Support لفتح تذكرة مساعدة.\n\n' +
      '⚡ Fast service | Secure orders'
    )
    .setFooter({
      text: 'VENOM SHOP | Official Store',
    })
    .setTimestamp();

  if (
    SHOP_BANNER_URL &&
    /^https?:\/\/\S+$/i.test(SHOP_BANNER_URL)
  ) {
    embed.setImage(SHOP_BANNER_URL);
  }

  return embed;
}

// ==========================================
// SHOP COMPONENTS
// ==========================================

function shopComponents() {
  const rows = [];

  const available = [...products.values()]
    .filter(product => product.stock > 0)
    .slice(0, 25);

  if (available.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('venom_product_select')
      .setPlaceholder('🛒 اختر منتجًا للشراء')
      .addOptions(
        available.map(product => ({
          label: product.name.slice(0, 100),
          description:
            `السعر: ${product.price} | المخزون: ${product.stock}`
              .slice(0, 100),
          value: product.id,
        }))
      );

    rows.push(
      new ActionRowBuilder().addComponents(menu)
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('venom_open_support')
        .setLabel('Support')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    )
  );

  return rows;
}

// ==========================================
// SLASH COMMANDS
// ==========================================

const commands = [
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Open the VENOM SHOP'),

  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the VENOM ticket panel'),

  new SlashCommandBuilder()
    .setName('addproduct')
    .setDescription('Add a shop product')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Product name')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('price')
        .setDescription('Product price')
        .setMinValue(0)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('stock')
        .setDescription('Available quantity')
        .setMinValue(0)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Optional product image URL')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('setstock')
    .setDescription('Update product stock')
    .addStringOption(option =>
      option
        .setName('product_id')
        .setDescription('Product ID')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('quantity')
        .setDescription('New stock quantity')
        .setMinValue(0)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('removeproduct')
    .setDescription('Remove a shop product')
    .addStringOption(option =>
      option
        .setName('product_id')
        .setDescription('Product ID')
        .setRequired(true)
    ),
].map(command => command.toJSON());

// ==========================================
// REGISTER COMMANDS
// ==========================================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, {
    body: commands,
  });

  console.log('Slash commands registered successfully.');
}

// ==========================================
// BOT READY
// ==========================================

client.once(Events.ClientReady, readyClient => {
  console.log(
    `VENOM SHOP online as ${readyClient.user.tag}`
  );
});

// ==========================================
// INTERACTIONS
// ==========================================

client.on(Events.InteractionCreate, async interaction => {
  try {

    // ======================================
    // SLASH COMMANDS
    // ======================================

    if (interaction.isChatInputCommand()) {

      // ---------- SHOP ----------

      if (interaction.commandName === 'shop') {
        await interaction.reply({
          embeds: [shopEmbed()],
          components: shopComponents(),
          ephemeral: true,
        });

        return;
      }

      // ---------- TICKET PANEL ----------

      if (interaction.commandName === 'ticketpanel') {
        if (!(await requireStaff(interaction))) {
          return;
        }

        if (!interaction.channel) {
          await interaction.reply({
            content: '❌ لا يمكن نشر اللوحة هنا.',
            ephemeral: true,
          });

          return;
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('venom_open_shop')
            .setLabel('Open Shop')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId('venom_open_support')
            .setLabel('Support')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({
          embeds: [shopEmbed()],
          components: [row],
        });

        await interaction.reply({
          content: '✅ تم نشر لوحة VENOM SHOP.',
          ephemeral: true,
        });

        return;
      }

      // ---------- PRODUCT COMMANDS ----------

      if (
        [
          'addproduct',
          'setstock',
          'removeproduct',
        ].includes(interaction.commandName)
      ) {
        if (!(await requireStaff(interaction))) {
          return;
        }

        // ADD PRODUCT

        if (interaction.commandName === 'addproduct') {
          const name = interaction.options
            .getString('name', true)
            .trim();

          const price = interaction.options
            .getNumber('price', true);

          const stock = interaction.options
            .getInteger('stock', true);

          const image = interaction.options
            .getString('image') || '';

          if (!name || name.length > 256) {
            await interaction.reply({
              content: '❌ اسم المنتج يجب أن يكون بين 1 و256 حرفًا.',
              ephemeral: true,
            });

            return;
          }

          if (
            !Number.isFinite(price) ||
            price < 0
          ) {
            await interaction.reply({
              content: '❌ السعر غير صالح.',
              ephemeral: true,
            });

            return;
          }

          if (
            image &&
            !/^https?:\/\/\S+$/i.test(image)
          ) {
            await interaction.reply({
              content: '❌ رابط الصورة غير صالح.',
              ephemeral: true,
            });

            return;
          }

          const id = slugify(name);

          if (products.has(id)) {
            await interaction.reply({
              content:
                `❌ المنتج موجود بالفعل. ID: \`${id}\``,
              ephemeral: true,
            });

            return;
          }

          const product = {
            id,
            name,
            price,
            stock,
            image,
          };

          products.set(id, product);

          if (!saveProducts()) {
            products.delete(id);

            await interaction.reply({
              content: '❌ تعذّر حفظ المنتج.',
              ephemeral: true,
            });

            return;
          }

          await interaction.reply({
            content:
              `✅ تمت إضافة **${name}** بنجاح.\n` +
              `🆔 Product ID: \`${id}\`\n` +
              `💰 Price: ${price}\n` +
              `📦 Stock: ${stock}`,
            ephemeral: true,
          });

          return;
        }

        const id = interaction.options
          .getString('product_id', true)
          .trim();

        const product = products.get(id);

        if (!product) {
          await interaction.reply({
            content: `❌ المنتج غير موجود: \`${id}\``,
            ephemeral: true,
          });

          return;
        }

        // UPDATE STOCK

        if (interaction.commandName === 'setstock') {
          const quantity = interaction.options
            .getInteger('quantity', true);

          const oldStock = product.stock;

          product.stock = quantity;

          if (!saveProducts()) {
            product.stock = oldStock;

            await interaction.reply({
              content: '❌ تعذّر حفظ تغييرات المخزون.',
              ephemeral: true,
            });

            return;
          }

          await interaction.reply({
            content:
              `✅ مخزون **${product.name}** أصبح **${quantity}**.`,
            ephemeral: true,
          });

          return;
        }

        // REMOVE PRODUCT

        products.delete(id);

        if (!saveProducts()) {
          products.set(id, product);

          await interaction.reply({
            content: '❌ تعذّر حذف المنتج من التخزين.',
            ephemeral: true,
          });

          return;
        }

        await interaction.reply({
          content: `✅ تم حذف **${product.name}**.`,
          ephemeral: true,
        });

        return;
      }
    }

    // ======================================
    // BUTTONS
    // ======================================

    if (interaction.isButton()) {

      // ---------- OPEN SHOP ----------

      if (interaction.customId === 'venom_open_shop') {
        await interaction.reply({
          embeds: [shopEmbed()],
          components: shopComponents(),
          ephemeral: true,
        });

        return;
      }

      // ---------- OPEN SUPPORT ----------

      if (interaction.customId === 'venom_open_support') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'استخدم هذا الزر داخل السيرفر.',
            ephemeral: true,
          });

          return;
        }

        await interaction.deferReply({
          ephemeral: true,
        });

        let channel;

        try {
          const username = slugify(
            interaction.user.username
          ).slice(0, 24);

          channel = await createPrivateChannel(
            interaction.guild,
            `support-${username}`,
            interaction.user.id
          );

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('venom_close_ticket')
              .setLabel('Close ticket')
              .setStyle(ButtonStyle.Danger)
          );

          await channel.send({
            content:
              `${interaction.user}` +
              (
                STAFF_ROLE_ID
                  ? ` <@&${STAFF_ROLE_ID}>`
                  : ''
              ),

            embeds: [
              new EmbedBuilder()
                .setColor(BLUE)
                .setTitle('🎫 VENOM SUPPORT')
                .setDescription(
                  'اكتب مشكلتك هنا وسيساعدك فريق الإدارة.'
                ),
            ],

            components: [row],
          });

        } catch (error) {
          console.error(
            'Support ticket creation error:',
            error
          );

          if (channel) {
            await channel.delete().catch(() => {});
          }

          await interaction.editReply(
            '❌ تعذّر إنشاء التذكرة. تحقق من صلاحيات البوت.'
          );

          return;
        }

        await interaction.editReply(
          `✅ تم إنشاء تذكرة الدعم: ${channel}`
        );

        return;
      }

      // ---------- CLOSE TICKET ----------

      if (
        interaction.customId === 'venom_close_ticket' ||
        interaction.customId === 'venom_close_order'
      ) {
        if (!interaction.guild || !interaction.channel) {
          await interaction.reply({
            content: 'هذا الزر غير متاح هنا.',
            ephemeral: true,
          });

          return;
        }

        const ownsTicket =
          interaction.channel.permissionOverwrites.cache.has(
            interaction.user.id
          );

        if (!isStaff(interaction) && !ownsTicket) {
          await interaction.reply({
            content: '❌ لا يمكنك إغلاق هذه التذكرة.',
            ephemeral: true,
          });

          return;
        }

        await interaction.reply({
          content: '🔒 سيتم حذف التذكرة بعد 5 ثوانٍ.',
        });

        const channel = interaction.channel;

        setTimeout(() => {
          channel.delete('VENOM ticket closed')
            .catch(console.error);
        }, 5000);

        return;
      }

      // ---------- CONFIRM PAYMENT ----------

      if (
        interaction.customId.startsWith('venom_paid_')
      ) {
        if (!(await requireStaff(interaction))) {
          return;
        }

        const match = interaction.customId.match(
          /^venom_paid_(.+)_(\d+)_(\d{17,20})$/
        );

        if (!match) {
          await interaction.reply({
            content: '❌ بيانات الطلب غير صالحة.',
            ephemeral: true,
          });

          return;
        }

        const productId = match[1];
        const quantity = Number(match[2]);
        const customerId = match[3];

        const product = products.get(productId);

        if (!product) {
          await interaction.reply({
            content: '❌ المنتج غير موجود.',
            ephemeral: true,
          });

          return;
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          await interaction.reply({
            content: '❌ الكمية غير صالحة.',
            ephemeral: true,
          });

          return;
        }

        const currentEmbed =
          interaction.message.embeds[0];

        if (!currentEmbed) {
          await interaction.reply({
            content: '❌ بيانات الطلب غير موجودة.',
            ephemeral: true,
          });

          return;
        }

        const alreadyPaid =
          currentEmbed.fields?.some(
            field =>
              field.name === '📌 Status' &&
              field.value.includes('Payment confirmed')
          );

        if (alreadyPaid) {
          await interaction.reply({
            content: '⚠️ تمت معالجة هذا الطلب مسبقًا.',
            ephemeral: true,
          });

          return;
        }

        if (product.stock < quantity) {
          await interaction.reply({
            content:
              `❌ المخزون غير كافٍ. المتوفر: ${product.stock}`,
            ephemeral: true,
          });

          return;
        }

        // Save inventory before confirming payment.

        const oldStock = product.stock;

   
