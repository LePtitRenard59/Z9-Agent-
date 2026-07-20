import type { ButtonInteraction } from 'discord.js'
import { faqPanelStore } from '../../db/faqPanels'
import { buildEmbed } from '../embeds/render'

/** Clic sur un bouton FAQ → réponse éphémère (customId faq:b:<panelId>:<idx>). */
export async function onFaqButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':')
  const panel = faqPanelStore.get(Number(parts[2]))
  const button = panel?.buttons[Number(parts[3])]
  if (!panel || !button) {
    await interaction.reply({ content: '❌ Cette question n’est plus disponible.', ephemeral: true })
    return
  }
  const embed = buildEmbed(button.answer)
  const content = button.answer.content || undefined
  if (!embed && !content) {
    await interaction.reply({ content: 'ℹ️ Aucune réponse n’a encore été configurée pour ce bouton.', ephemeral: true })
    return
  }
  await interaction.reply({ content, embeds: embed ? [embed] : [], ephemeral: true })
}
