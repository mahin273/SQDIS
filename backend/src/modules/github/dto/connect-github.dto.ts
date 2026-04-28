/**eslint-disable */
import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for connecting GitHub PAT to organization
 */

export class ConnectGithubDto{
@ApiProperty({
  description:
  "GitHub Personal Access Token with required scopes (repo, read:org, admin:repo_hook)",
  example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  minLength:40,
})
@IsString()
@IsNotEmpty()
@MinLength(40,{message:"Invalid GitHub PAT format"})
pat: string
}
