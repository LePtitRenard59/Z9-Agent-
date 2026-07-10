import { SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Vérifie que le bot répond et affiche sa latence.'),
  async execute(interaction) {
    await interaction.reply({
      content: `🏓 Pong ! Latence WebSocket : ${Math.round(interaction.client.ws.ping)} ms`,
      ephemeral: true,
    })
  },
}
