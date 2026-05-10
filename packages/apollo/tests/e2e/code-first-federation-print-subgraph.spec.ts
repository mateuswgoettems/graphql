import { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { ApolloDriverConfig } from '../../lib';
import { ApolloFederationDriver } from '../../lib/drivers';
import { printSubgraphSchema } from '@apollo/subgraph';
import { GraphQLModule } from '@nestjs/graphql';
import { ApplicationModule } from '../code-first-federation/app.module';
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PostModule } from '../code-first-federation/post/post.module';
import { RecipeModule } from '../code-first-federation/recipe/recipe.module';
import { UserModule } from '../code-first-federation/user/user.module';
import { HumanModule } from '../code-first-federation/human/human.module';
import { User } from '../code-first-federation/user/user.entity';

describe('Code-first Federation - printSubgraphSchema', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('should produce valid subgraph SDL with @key directives via printSubgraphSchema', async () => {
    const module = await Test.createTestingModule({
      imports: [ApplicationModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    const schemaHost = app.get(GraphQLSchemaHost);
    const sdl = printSubgraphSchema(schemaHost.schema);

    expect(sdl).toContain('@key(fields: "id")');
    expect(sdl).toContain('type Post');
    expect(sdl).toContain('type User');
    // printSubgraphSchema strips federation infrastructure (@key definition, _entities/_service)
    // but preserves usage of federation directives on types
    expect(sdl).toContain('@external');
  });

  it('should write a valid subgraph SDL file when autoSchemaFile is a path', async () => {
    const tmpFile = path.join(os.tmpdir(), `test-federation-schema-${Date.now()}.gql`);

    try {
      const module = await Test.createTestingModule({
        imports: [
          UserModule,
          PostModule,
          RecipeModule,
          HumanModule,
          GraphQLModule.forRoot<ApolloDriverConfig>({
            inheritResolversFromInterfaces: true,
            driver: ApolloFederationDriver,
            includeStacktraceInErrorResponses: false,
            autoSchemaFile: tmpFile,
            buildSchemaOptions: {
              orphanedTypes: [User],
            },
            plugins: [ApolloServerPluginInlineTraceDisabled()],
          }),
        ],
      }).compile();

      app = module.createNestApplication();
      await app.init();

      const fileContent = fs.readFileSync(tmpFile, 'utf-8');

      expect(fileContent).toContain('@key(fields: "id")');
      expect(fileContent).toContain('type Post');
      expect(fileContent).toContain('type User');
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });
});
