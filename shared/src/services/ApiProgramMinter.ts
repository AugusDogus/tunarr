import { ContentProgram, ExternalId } from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import {
  ContentProgramOriginalProgram,
  ContentProgramTypeSchema,
  ExternalSourceTypeSchema,
  SingleExternalIdType,
} from '@tunarr/types/schemas';
import { find, first, isError, isNil } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { createExternalId } from '../index.js';
import { nullToUndefined, seq } from '../util/index.js';
import { parsePlexGuid } from '../util/plexUtil.js';

type MediaSourceDetails = { id: string; name: string };

export class ApiProgramMinter {
  /**
   * Creates an non-persisted, ephemeral ContentProgram for the given
   * EnrichedPlexMedia. These are handed off to the server to persist
   * to the database (if they don't already exist). They are also useful
   * in order to deal with a common type for programming throughout other
   * parts of the UI
   */

  static mintProgram(
    mediaSource: { id: string; name: string },
    program: ContentProgramOriginalProgram,
  ): ContentProgram {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) => this.mintFromPlexMovie(mediaSource, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintFromPlexEpisode(mediaSource, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) => this.mintFromPlexMusicTrack(mediaSource, track),
      )
      .with(
        {
          sourceType: 'jellyfin',
          program: { Type: P.union('Movie', 'Audio', 'Episode') },
        },
        ({ program }) => this.mintProgramForJellyfinItem(mediaSource, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  private static mintFromPlexMovie(
    server: MediaSourceDetails,
    plexMovie: PlexMovie,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexMovie.ratingKey);
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      type: 'content',
      externalSourceType: 'plex',
      externalSourceName: server.name,
      date: plexMovie.originallyAvailableAt,
      duration: plexMovie.duration ?? 0,
      serverFileKey: file?.key,
      serverFilePath: file?.file,
      externalKey: plexMovie.ratingKey,
      rating: plexMovie.contentRating,
      summary: plexMovie.summary,
      title: plexMovie.title,
      subtype: 'movie',
      persisted: false,
      externalIds: this.mintExternalIdsForPlex(server.name, plexMovie),
      externalSourceId: server.name,
      uniqueId: id,
      id,
    };
  }

  private static mintFromPlexEpisode(
    server: MediaSourceDetails,
    plexEpisode: PlexEpisode,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexEpisode.ratingKey);
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      date: plexEpisode.originallyAvailableAt,
      duration: plexEpisode.duration ?? 0,
      index: plexEpisode.index,
      externalKey: plexEpisode.ratingKey,
      externalSourceName: server.name,
      externalSourceId: server.name,
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      parent: {
        title: plexEpisode.parentTitle,
        index: plexEpisode.parentIndex,
        externalKey: plexEpisode.parentRatingKey,
        guids: plexEpisode.parentGuid ? [plexEpisode.parentGuid] : [],
      },
      grandparent: {
        title: plexEpisode.grandparentTitle,
        externalKey: plexEpisode.grandparentRatingKey,
        guids: plexEpisode.grandparentGuid ? [plexEpisode.grandparentGuid] : [],
      },
      rating: plexEpisode.contentRating,
      seasonNumber: plexEpisode.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.episode,
      summary: plexEpisode.summary,
      title: plexEpisode.title,
      type: 'content',
      externalIds: this.mintExternalIdsForPlex(server.name, plexEpisode),
      persisted: false,
      id: id,
      uniqueId: id,
    };
  }

  private static mintFromPlexMusicTrack(
    server: MediaSourceDetails,
    plexTrack: PlexMusicTrack,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexTrack.ratingKey);
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      duration: plexTrack.duration ?? 0,
      index: plexTrack.index,
      externalKey: plexTrack.ratingKey,
      externalSourceName: server.name,
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      parent: {
        title: plexTrack.parentTitle,
        index: plexTrack.parentIndex,
        externalKey: plexTrack.parentRatingKey,
        guids: plexTrack.parentGuid ? [plexTrack.parentGuid] : [],
        year: plexTrack.parentYear,
      },
      grandparent: {
        title: plexTrack.grandparentTitle,
        externalKey: plexTrack.grandparentRatingKey,
        guids: plexTrack.grandparentGuid ? [plexTrack.grandparentGuid] : [],
      },
      // grandparentExternalKey: plexTrack.grandparentRatingKey,
      // grandparentTitle: plexTrack.grandparentTitle,
      seasonNumber: plexTrack.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.track,
      summary: plexTrack.summary,
      title: plexTrack.title,
      type: 'content',
      externalIds: this.mintExternalIdsForPlex(server.name, plexTrack),
      persisted: false,
      uniqueId: id,
      id,
      externalSourceId: server.name,
    };
  }

  private static mintProgramForJellyfinItem(
    server: MediaSourceDetails,
    item: Omit<JellyfinItem, 'Type'> & { Type: 'Movie' | 'Episode' | 'Audio' },
  ): ContentProgram {
    const id = createExternalId('jellyfin', server.name, item.Id);
    return {
      externalSourceType: ExternalSourceTypeSchema.enum.jellyfin,
      date: nullToUndefined(item.PremiereDate),
      duration: (item.RunTimeTicks ?? 0) / 10_000,
      externalSourceId: server.name,
      externalKey: item.Id,
      rating: nullToUndefined(item.OfficialRating),
      summary: nullToUndefined(item.Overview),
      title: item.Name ?? '',
      type: 'content',
      subtype: match(item.Type)
        .with('Movie', () => ContentProgramTypeSchema.enum.movie)
        .with('Episode', () => ContentProgramTypeSchema.enum.episode)
        .with('Audio', () => ContentProgramTypeSchema.Enum.track)
        .exhaustive(),
      year: nullToUndefined(item.ProductionYear),
      parent: {
        title: nullToUndefined(item.SeasonName ?? item.Album),
        index: nullToUndefined(item.ParentIndexNumber),
        externalKey: nullToUndefined(
          item.ParentId ?? item.SeasonId ?? item.AlbumId,
        ),
      },
      grandparent: {
        title: nullToUndefined(item.SeriesName ?? item.AlbumArtist),
        externalKey:
          item.SeriesId ??
          find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id,
      },
      seasonNumber: nullToUndefined(item.ParentIndexNumber),
      episodeNumber: nullToUndefined(item.IndexNumber),
      index: nullToUndefined(item.IndexNumber),
      externalIds: this.mintExternalIdsForJellyfin(server.name, item),
      uniqueId: id,
      id,
      externalSourceName: server.name,
      persisted: false,
    };
  }

  static mintExternalIds(
    serverName: string,
    originalProgram: ContentProgramOriginalProgram,
  ) {
    return match(originalProgram)
      .with({ sourceType: 'plex' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForPlex(serverName, originalProgram),
      )
      .with({ sourceType: 'jellyfin' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForJellyfin(serverName, originalProgram),
      )
      .exhaustive();
  }

  static mintExternalIdsForPlex(
    serverName: string,
    media: PlexTerminalMedia,
  ): ExternalId[] {
    // const file = first(first(media.Media)?.Part ?? []);
    // TODO: add file details and stuff.
    const ratingId = {
      source: 'plex',
      id: media.ratingKey,
      sourceId: serverName,
      type: 'multi',
    } satisfies ExternalId;

    const guidId = {
      // uuid: v4(),
      // createdAt: +dayjs(),
      // updatedAt: +dayjs(),
      type: 'single',
      source: 'plex-guid',
      id: media.guid,
      // sourceType: ProgramExternalIdType.PLEX_GUID,
      // programUuid: programId,
    } satisfies ExternalId;

    const externalGuids = seq.collect(media.Guid, (externalGuid) => {
      // Plex returns these in a URI form, so we can attempt to parse them
      return parsePlexGuid(externalGuid.id);
    });

    return [ratingId, guidId, ...externalGuids];
  }

  static mintJellyfinExternalId(serverName: string, media: JellyfinItem) {
    return {
      // uuid: v4(),
      // createdAt: +dayjs(),
      // updatedAt: +dayjs(),
      type: 'multi',
      id: media.Id,
      source: 'jellyfin',
      // sourceType: ProgramExternalIdType.JELLYFIN,
      // programUuid: programId,
      sourceId: serverName,
    } satisfies ExternalId;
  }

  static mintExternalIdsForJellyfin(serverName: string, media: JellyfinItem) {
    const ratingId = this.mintJellyfinExternalId(serverName, media);

    const externalGuids = seq.collectMapValues(
      media.ProviderIds,
      (externalGuid, guidType) => {
        if (isNil(externalGuid)) {
          return;
        }

        let source: SingleExternalIdType | null = null;
        const normalizedType = guidType.toLowerCase();
        switch (normalizedType) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            source = normalizedType as SingleExternalIdType;
            break;
          default:
            return null;
        }

        if (source) {
          return {
            id: externalGuid,
            source,
            type: 'single',
          } satisfies ExternalId;
        }

        return;
      },
    );

    return [ratingId, ...externalGuids];
  }
}
