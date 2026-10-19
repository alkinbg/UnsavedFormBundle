<?php

declare(strict_types=1);

namespace Novora\UnsavedFormBundle;

use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

final class UnsavedFormBundle extends AbstractBundle
{
    public function prependExtension(ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        if (!interface_exists(AssetMapperInterface::class)) {
            return;
        }

        $bundles = $builder->getParameter('kernel.bundles_metadata');

        if (!isset($bundles['FrameworkBundle'])) {
            return;
        }

        $frameworkPath = $bundles['FrameworkBundle']['path'];

        if (!isset($bundles['AssetMapperBundle']) && !is_file($frameworkPath.'/Resources/config/asset_mapper.php')) {
            return;
        }

        $builder->prependExtensionConfig('framework', [
            'asset_mapper' => [
                'paths' => [
                    __DIR__.'/../assets/dist' => '@alkin/unsaved-form-bundle',
                ],
            ],
        ]);
    }
}
