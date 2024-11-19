import { ExternalId } from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { trimEnd } from 'lodash-es';

export const parsePlexGuid = (guid: string): ExternalId | null => {
  if (!URL.canParse(guid)) {
    return null;
  }

  // const parsed = attemptSync(() => new URL(guid));
  const parsed = new URL(guid);
  const idType = trimEnd(parsed.protocol, ':');
  if (!isValidSingleExternalIdType(idType)) {
    return null;
    // return {
    //   sourceType: programExternalIdTypeFromExternalIdType(idType),
    //   externalKey: parsed.hostname,
    // };
  }

  return {
    type: 'single',
    source: idType,
    id: parsed.hostname,
  };
};
