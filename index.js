
try {
  await interaction.user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x008CFF)
        .setTitle("🛒 VENOM SHOP")
        .setDescription(
          `تم استلام طلب الشراء بنجاح!\n\n` +
          `🎟️ التذكرة: ${ticketChannel}\n` +
          `📦 المنتج: ${product.name}\n` +
          `💰 السعر: ${product.price}\n` +
          `⏳ الحالة: في انتظار تأكيد الدفع`
        )
        .setTimestamp()
    ]
  });
} catch (error) {
  console.log("لم أستطع إرسال رسالة الخاص للزبون.");
}
stock;
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
