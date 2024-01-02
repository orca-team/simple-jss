/* eslint-disable @typescript-eslint/no-explicit-any */
import isBrowser from 'is-in-browser';
import { Classes, Plugin, StyleSheetFactoryOptions, Styles, create, getDynamicStyles } from 'jss';
import preset from 'jss-preset-default';
import React, { useDebugValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getManager, manageSheet, unmanageSheet } from './manager';

const isSSR = !isBrowser;

interface BaseOptions extends StyleSheetFactoryOptions {
  index?: number;
}

interface CreateUseStylesOptions extends BaseOptions {
  plugins?: Plugin[];
}

const useIsomorphicEffect = isSSR ? React.useInsertionEffect || useLayoutEffect : useEffect;

let index = 0;
const getSheetIndex = () => index++;

function mergeClasses<T extends Classes>(sheet: T, dynamic?: T) {
  const classes: T = { ...sheet };
  if (!dynamic) {
    return sheet;
  }
  for (const dynamicKey in dynamic) {
    if (dynamicKey in sheet) {
      // @ts-expect-error
      classes[dynamicKey] += ` ${dynamic[dynamicKey]}`;
    } else {
      // @ts-expect-error
      classes[dynamicKey] = ` ${dynamic[dynamicKey]}`;
    }
  }
  return classes;
}

export default function createUseStyles<C extends string = string, Props = any>(
  styles: Styles<C, Props>,
  options: CreateUseStylesOptions = {},
) {
  const { index = getSheetIndex(), plugins = [], classNamePrefix: _classNamePrefix = '', ...otherOptions } = options;
  let classNamePrefix = _classNamePrefix;
  if (classNamePrefix && !classNamePrefix.endsWith('-')) {
    classNamePrefix += '-';
  }
  const key = {};

  const jss = create(preset());
  jss.use(...plugins);

  const dynamicStyles = getDynamicStyles(styles as Styles);
  const sheet = jss.createStyleSheet(styles, {
    index,
    meta: `${_classNamePrefix}-jss-default`,
    link: false,
    classNamePrefix,
    ...otherOptions,
  });

  const dynamicKey = {};
  // 渲染样式
  function load() {
    const manager = getManager(index);
    manager.add(key, sheet);
    manageSheet(key, {
      index,
      sheet,
    });

    // dynamicKey
    if (dynamicStyles) {
      let dynamicSheet = manager.get(dynamicKey);
      if (!dynamicSheet) {
        manager.add(
          dynamicKey,
          jss.createStyleSheet(dynamicStyles, {
            index,
            meta: `${_classNamePrefix}-jss-dynamic`,
            link: true,
          }),
        );
      }
      dynamicSheet = manager.get(dynamicKey);
      manageSheet(dynamicKey, {
        index,
        sheet: dynamicSheet,
      });
    }
  }

  function unload() {
    unmanageSheet(key, {
      index,
      sheet,
    });
    if (dynamicStyles) {
      const manager = getManager(index);
      const dynamicSheet = manager.get(dynamicKey);
      unmanageSheet(dynamicKey, {
        index,
        sheet: dynamicSheet,
      });
    }
  }

  function updateDynamicSheet(data: any) {
    if (dynamicStyles) {
      const manager = getManager(index);
      const dynamicSheet = manager.get(dynamicKey);
      dynamicSheet?.update(data);
    }
  }

  function useStyles(data?: Props): Classes<C> {
    const isFirstMount = useRef(true);

    const [dynamicKey] = useState({});

    useMemo(() => {
      const manager = getManager(index);
      const existingSheet = manager.get(key);

      if (existingSheet) {
        return [];
      }
      manager.add(key, sheet);

      if (sheet && isSSR) {
        // manage immediately during SSRs. browsers will manage the sheet through useInsertionEffect below
        manageSheet(key, {
          index,
          sheet,
        });
      }

      return [];
    }, []);

    const dynamicSheet = useMemo(() => {
      if (!dynamicStyles) return null;
      const dynamicSheet = jss.createStyleSheet(dynamicStyles, {
        index,
        meta: `${_classNamePrefix}-jss-dynamic`,
        link: true,
      });

      const manager = getManager(index);
      manager.add(dynamicKey, dynamicSheet);
      if (dynamicSheet && isSSR) {
        // manage immediately during SSRs. browsers will manage the sheet through useInsertionEffect below
        manageSheet(dynamicKey, {
          index,
          sheet: dynamicSheet,
        });
      }
      return dynamicSheet;
    }, []);

    useIsomorphicEffect(() => {
      // We only need to update the rules on a subsequent update and not in the first mount
      // if (sheet && dynamicRules && !isFirstMount.current) {
      //   updateDynamicRules(data, sheet, dynamicRules);
      // }
      if (dynamicSheet && data) {
        dynamicSheet.update(data);
      }
    }, [data, dynamicSheet]);

    useIsomorphicEffect(() => {
      if (sheet) {
        manageSheet(key, {
          index,
          sheet,
        });
      }
      if (dynamicSheet) {
        manageSheet(dynamicKey, {
          index,
          sheet: dynamicSheet,
        });
      }

      return () => {
        if (sheet) {
          unmanageSheet(key, {
            index,
            sheet,
          });
        }
        if (dynamicSheet) {
          unmanageSheet(dynamicKey, {
            index,
            sheet: dynamicSheet,
          });
        }
      };
    }, []);

    const classes = useMemo<Classes<C>>(
      () => mergeClasses(sheet.classes, dynamicSheet?.classes),
      [sheet, dynamicSheet],
    );

    useDebugValue(classes);

    useEffect(() => {
      isFirstMount.current = false;
    });

    return classes;
  }

  useStyles.load = load;
  useStyles.unload = unload;
  useStyles.update = updateDynamicSheet;

  return useStyles;
}
