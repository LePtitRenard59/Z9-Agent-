import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { startGreetingEditor } from '../features/greetings/builder'

export const welcomeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configurer le message de bienvenue automatique')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  execute: interaction => startGreetingEditor(interaction, 'welcome'),
}

export const goodbyeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('Configurer le message de départ automatique')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  execute: interaction => startGreetingEditor(interaction, 'goodbye'),
}
