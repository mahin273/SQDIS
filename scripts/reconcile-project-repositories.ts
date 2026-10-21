import { PrismaClient } from '@prisma/client'

async function reconcileProjectRepositories() {
  const prisma = new PrismaClient()

  console.log('Starting project-repository reconciliation...')

  try {
    const repositories = await prisma.repository.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        organizationId: true,
      },
    })

    console.log(`Found ${repositories.length} enabled repositories in database.`)

    let linkedCount = 0
    let createdProjectCount = 0

    for (const repo of repositories) {
      const existingLink = await prisma.projectRepository.findFirst({
        where: { repositoryId: repo.id },
      })

      if (existingLink) {
        console.log(`Repository '${repo.fullName}' is already linked to project ${existingLink.projectId}.`)
        continue
      }

      console.log(`Repository '${repo.fullName}' is not linked to any project. Reconciling...`)

      let project = await prisma.project.findFirst({
        where: {
          organizationId: repo.organizationId,
          name: repo.name,
        },
      })

      if (!project) {
        project = await prisma.project.create({
          data: {
            organizationId: repo.organizationId,
            name: repo.name,
            description: `Auto-created project for repository ${repo.fullName}`,
            isActive: true,
          },
        })
        createdProjectCount++
        console.log(`Created new Project '${project.name}' (${project.id}) for organization ${repo.organizationId}.`)
      }

      await prisma.projectRepository.create({
        data: {
          projectId: project.id,
          repositoryId: repo.id,
        },
      })

      linkedCount++
      console.log(`Successfully linked repository '${repo.fullName}' to project '${project.name}'.`)
    }

    console.log(`Reconciliation complete. Created ${createdProjectCount} projects, linked ${linkedCount} repositories.`)
  } catch (error) {
    console.error('Reconciliation failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

reconcileProjectRepositories()
