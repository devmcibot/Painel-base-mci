"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// Atualiza o nome do médico com validação manual
export async function updateProfile(userId: number, formData: FormData) {
  const name = formData.get("name");

  // Validação manual em vez de Zod
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return {
      error: "O nome é obrigatório e precisa ter no mínimo 3 caracteres.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() }, // Usamos .trim() para remover espaços em branco
    });
    revalidatePath("/perfil"); // Atualiza o cache da página
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível atualizar o perfil." };
  }
}

// Atualiza os horários de atendimento (sem alterações aqui)
export async function updateHorarios(
  medicoId: number,
  horarios: { weekday: number; startMin: number; endMin: number }[]
) {
  try {
    await prisma.$transaction([
      prisma.medicoHorario.deleteMany({
        where: { medicoId: medicoId },
      }),
      prisma.medicoHorario.createMany({
        data: horarios.map((h) => ({ ...h, medicoId })),
      }),
    ]);
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível salvar os horários." };
  }
}

// Adiciona uma nova ausência (sem alterações aqui)
export async function addAusencia(
  medicoId: number,
  data: { inicio: Date; fim: Date; motivo?: string }
) {
  // Validação simples para datas
  if (!data.inicio || !data.fim || data.inicio >= data.fim) {
    return { error: "A data de início deve ser anterior à data de fim." };
  }

  try {
    await prisma.medicoAusencia.create({
      data: {
        medicoId,
        inicio: data.inicio,
        fim: data.fim,
        motivo: data.motivo,
      },
    });
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível adicionar a ausência." };
  }
}

// Remove uma ausência (sem alterações aqui)
export async function deleteAusencia(ausenciaId: number) {
  try {
    await prisma.medicoAusencia.delete({
      where: { id: ausenciaId },
    });
    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Não foi possível remover a ausência." };
  }
}
